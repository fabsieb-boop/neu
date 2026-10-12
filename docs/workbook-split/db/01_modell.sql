-- ============================================================================
--  Controlling-Datenmodell: Reparatur + KLR-Klassifizierung
--  Schema: controlling
--
--  Dieses Skript ist idempotent und kann jederzeit erneut ausgefuehrt werden.
--
--  Vorzeichenkonvention der Quelldaten (SAP CO-Export):
--    Kosten/Aufwand   = positiv (Soll)
--    Erloese/Ertraege = negativ (Haben)
--  Normalisiert wird immer ueber die KONTOART, nie ueber das vorgefundene
--  Vorzeichen. Sonst kippen zwei Faelle:
--    - Bestandsabbau steht in SAP positiv und muss nach dem Drehen negativ
--      bleiben, weil er die Gesamtleistung mindert.
--    - Erloesschmaelerungen stehen in SAP positiv und muessen nach dem Drehen
--      negativ sein, damit sie den Umsatz kuerzen statt ihn zu erhoehen.
--  Auswertung:
--    leistung = -wert   (Erloese werden positiv dargestellt)
--    kosten   = +wert   (Kosten bleiben positiv)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Stammdaten-Erweiterungen
-- ---------------------------------------------------------------------------

ALTER TABLE controlling.projekte
  ADD COLUMN IF NOT EXISTS auftragstyp   VARCHAR(20),   -- PROJEKT | INNENAUFTRAG
  ADD COLUMN IF NOT EXISTS regionscode   VARCHAR(4),
  ADD COLUMN IF NOT EXISTS region        VARCHAR(40);

ALTER TABLE controlling.kostenarten
  ADD COLUMN IF NOT EXISTS kontonummer      INTEGER,
  ADD COLUMN IF NOT EXISTS klr_gruppe       VARCHAR(40),
  ADD COLUMN IF NOT EXISTS sortierung       INTEGER DEFAULT 999,
  ADD COLUMN IF NOT EXISTS kontoart         VARCHAR(30),
  ADD COLUMN IF NOT EXISTS planungsgruppe   VARCHAR(120),
  ADD COLUMN IF NOT EXISTS kostenblock      VARCHAR(120),
  ADD COLUMN IF NOT EXISTS sap_guv_position VARCHAR(120),
  ADD COLUMN IF NOT EXISTS ebitda_relevant  BOOLEAN,
  ADD COLUMN IF NOT EXISTS quelle           VARCHAR(30);

-- ---------------------------------------------------------------------------
-- 2. Regionen und Auftragstyp
--    Auftragsnummer: <Typ><Buchungskreis 4102><Regionscode 2><laufende Nr>
--    Beispiel: P4102157208 -> Typ P, BuKr 4102, Region 15, Nr 7208
--    Die Codes stammen aus dem TVF-Bestandssystem (js/db.js), damit beide
--    Auswertungen dieselben Regionen ausweisen.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION controlling.f_region(regionscode text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE regionscode
    WHEN '15' THEN 'West'
    WHEN '23' THEN 'Süd-West'
    WHEN '30' THEN 'Süd-West'
    WHEN '60' THEN 'Ost'
    WHEN '65' THEN 'Berlin'
    WHEN '99' THEN 'Berlin'
    WHEN '50' THEN 'Verwaltung'
    ELSE 'Ohne Zuordnung'
  END;
$$;

UPDATE controlling.projekte SET
  auftragstyp = CASE left(projekt_nr,1) WHEN 'P' THEN 'PROJEKT'
                                        WHEN 'W' THEN 'INNENAUFTRAG'
                                        ELSE 'SONSTIGES' END,
  regionscode = substring(projekt_nr from 6 for 2),
  region      = controlling.f_region(substring(projekt_nr from 6 for 2));

-- ---------------------------------------------------------------------------
-- 3. Fremdschluessel nachziehen (waren im Ausgangsbestand durchgaengig NULL)
-- ---------------------------------------------------------------------------

UPDATE controlling.buchungen b
   SET projekt_id = p.projekt_id
  FROM controlling.projekte p
 WHERE p.projekt_nr = b.auftrag
   AND b.projekt_id IS DISTINCT FROM p.projekt_id;

UPDATE controlling.buchungen b
   SET kostenart_id = k.kostenart_id
  FROM controlling.kostenarten k
 WHERE k.kostenart_nr = b.kostenart
   AND b.kostenart_id IS DISTINCT FROM k.kostenart_id;

-- ---------------------------------------------------------------------------
-- 4. Klassifizierungsregeln als Funktionen
--
--    Eine einzige Stelle bestimmt, wie ein Sachkonto eingeordnet wird. Das
--    Klassifizieren selbst laeuft ueber controlling.kostenarten_klassifizieren(),
--    damit nach jedem Import mit neuen Konten dieselbe Regel greift.
--
--    db_stufe  0 = Betriebsleistung (Erloese, Bestandsveraenderung)
--              1 = variable Einzelkosten          -> DB1
--              2 = fixe Kosten                    -> DB2 (Projekt) bzw. DB3/DB4
--              9 = neutrales Ergebnis             -> ausserhalb der DB-Rechnung
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION controlling.f_db_stufe(konto integer)
RETURNS smallint LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    -- Betriebsleistung
    WHEN konto BETWEEN 830000 AND 869999 THEN 0
    WHEN konto IN (890010, 890100, 890200, 890300, 890800) THEN 0  -- Erloese, Erloesschmaelerungen
    WHEN konto BETWEEN 390000 AND 399999 THEN 0                    -- Bestandsveraenderung
    -- neutrales Ergebnis
    WHEN konto IN (201000,231000,231500,240000,243000,251000,251300,252000,
                   273000,273200,273500,274200,286900)      THEN 9  -- periodenfremd / neutral
    WHEN konto BETWEEN 210000 AND 213999                    THEN 9  -- Zinsaufwand
    WHEN konto IN (265001,265900,287095)                    THEN 9  -- Zinsertrag
    WHEN konto IN (220000,221200,278000,278100,430010,430020,430040) THEN 9  -- Ertragsteuern
    WHEN konto IN (289200,289300,499200,499300)             THEN 9  -- kalkulatorisch + Verrechnung
    -- variable Einzelkosten (DB1)
    WHEN konto BETWEEN 300000 AND 319999                    THEN 1  -- Material, Hilfs-/Betriebsstoffe
    WHEN konto = 330900                                     THEN 1  -- erhaltene Skonti
    WHEN konto BETWEEN 340000 AND 359999                    THEN 1  -- Fremdleistungen
    WHEN konto = 401000                                     THEN 1  -- Diesel
    WHEN konto = 420060                                     THEN 1  -- eigene Entsorgung
    WHEN konto = 440050                                     THEN 1  -- Transportkosten
    WHEN konto BETWEEN 7611000 AND 7611999                  THEN 1  -- Lohnverrechnung
    WHEN konto = 7612000                                    THEN 1  -- Geraeteverrechnung
    -- alles Uebrige: fixe Kosten
    ELSE 2
  END::smallint;
$$;

CREATE OR REPLACE FUNCTION controlling.f_einzelkosten(konto integer)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT konto BETWEEN 300000 AND 359999
      OR konto IN (401000, 420060, 440050, 7612000)
      OR konto BETWEEN 7611000 AND 7611999;
$$;

CREATE OR REPLACE FUNCTION controlling.f_klr_typ(konto integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN konto BETWEEN 830000 AND 869999 THEN 'ERLOES'
    WHEN konto IN (890100, 890300)       THEN 'ERLOESSCHMAELERUNG'
    WHEN konto IN (890010, 890200, 890800) THEN 'ERLOES'
    WHEN konto BETWEEN 390000 AND 399999 THEN 'BESTANDSVERAENDERUNG'
    WHEN konto IN (251000,251300,252000,265001,265900,273000,273200,273500,274200,287095)
                                         THEN 'NEUTRALER_ERTRAG'
    WHEN konto IN (201000,231000,231500,240000,243000,286900) THEN 'NEUTRALER_AUFWAND'
    WHEN konto BETWEEN 210000 AND 213999 THEN 'ZINSEN'
    WHEN konto IN (220000,221200,278000,278100,430010,430020,430040) THEN 'STEUERN'
    WHEN konto IN (289200,289300,499200,499300) THEN 'KALKULATORISCH'
    WHEN konto BETWEEN 300000 AND 339999 THEN 'MATERIAL'
    WHEN konto BETWEEN 340000 AND 359999 THEN 'FREMDLEISTUNG'
    WHEN konto BETWEEN 7611000 AND 7611999 THEN 'LOHNVERRECHNUNG'
    WHEN konto = 7612000                 THEN 'GERAETEVERRECHNUNG'
    WHEN konto = 7801020                 THEN 'GEMEINKOSTENUMLAGE'
    WHEN konto BETWEEN 400000 AND 409999 THEN 'FUHRPARK'
    WHEN konto BETWEEN 410000 AND 419999 THEN 'PERSONAL'
    WHEN konto BETWEEN 420000 AND 429999 THEN 'RAUM_ANLAGEN'
    WHEN konto BETWEEN 430000 AND 439999 THEN 'VERSICHERUNG_MIETE'
    WHEN konto BETWEEN 440000 AND 449999 THEN 'TRANSPORT'
    WHEN konto BETWEEN 450000 AND 459999 THEN 'REISE_WERBUNG'
    WHEN konto BETWEEN 460000 AND 469999 THEN 'VERWALTUNG'
    WHEN konto BETWEEN 470000 AND 479999 THEN 'BERATUNG_UMLAGE'
    WHEN konto BETWEEN 480000 AND 489999 THEN 'ABSCHREIBUNG'
    ELSE 'SONSTIGES'
  END;
$$;

CREATE OR REPLACE FUNCTION controlling.f_klr_gruppe(konto integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN konto BETWEEN 830000 AND 869999
      OR konto IN (890010,890100,890200,890300,890800)  THEN 'Umsatzerlöse'
    WHEN konto BETWEEN 390000 AND 399999                THEN 'Bestandsveränderung'
    WHEN konto BETWEEN 300000 AND 359999                THEN 'Material und Fremdleistungen'
    WHEN konto BETWEEN 7611000 AND 7612999
      OR konto = 7801020                                THEN 'Innerbetriebliche Verrechnung'
    WHEN konto BETWEEN 400000 AND 409999                THEN 'Fuhrpark'
    WHEN konto BETWEEN 410000 AND 419999                THEN 'Personal'
    WHEN konto BETWEEN 420000 AND 429999                THEN 'Raum, Energie, Instandhaltung'
    WHEN konto BETWEEN 430000 AND 439999                THEN 'Versicherungen, Mieten, Steuern'
    WHEN konto BETWEEN 440000 AND 459999                THEN 'Transport, Reise, Werbung'
    WHEN konto BETWEEN 460000 AND 479999                THEN 'Verwaltung und Beratung'
    WHEN konto BETWEEN 480000 AND 489999                THEN 'Abschreibungen'
    WHEN konto BETWEEN 499000 AND 499999
      OR konto BETWEEN 289000 AND 289999                THEN 'Kalkulatorische Kosten'
    WHEN konto BETWEEN 210000 AND 213999
      OR konto IN (265001,265900,287095)                THEN 'Zinsergebnis'
    ELSE 'Sonstiges'
  END;
$$;

CREATE OR REPLACE FUNCTION controlling.f_guv_gruppe(konto integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN konto BETWEEN 830000 AND 869999
      OR konto IN (890010,890100,890200,890300,890800)  THEN '1 Umsatzerlöse'
    WHEN konto BETWEEN 390000 AND 399999                THEN '2 Bestandsveränderungen'
    WHEN konto IN (251000,251300,252000,273000,273200,273500,274200)
                                                        THEN '3 Sonstige betriebliche Erträge'
    WHEN konto BETWEEN 300000 AND 339999                THEN '4 Materialaufwand'
    WHEN konto BETWEEN 340000 AND 359999                THEN '5 Aufwand für bezogene Leistungen'
    WHEN konto BETWEEN 410000 AND 419999
      OR konto BETWEEN 7611000 AND 7611999              THEN '6 Personalaufwand'
    WHEN konto BETWEEN 480000 AND 489999                THEN '7 Abschreibungen'
    WHEN konto IN (289200,289300,499200,499300)         THEN '9 Kalkulatorische Kosten'
    WHEN konto BETWEEN 210000 AND 213999
      OR konto IN (265001,265900,287095)                THEN '10 Zinsergebnis'
    WHEN konto IN (220000,221200,278000,278100,430010,430020,430040)
                                                        THEN '11 Steuern vom Einkommen und Ertrag'
    WHEN konto IN (201000,231000,231500,240000,243000,286900)
                                                        THEN '12 Periodenfremdes Ergebnis'
    ELSE '8 Sonstige betriebliche Aufwendungen'
  END;
$$;

/* Kontoart nach der Systematik des TVF-Kontenstamms. Steuert die
   Vorzeichennormalisierung und die EBITDA-Abgrenzung. */
CREATE OR REPLACE FUNCTION controlling.f_kontoart(konto integer)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN controlling.f_klr_typ(konto) = 'BESTANDSVERAENDERUNG' THEN 'bestandsveraenderung'
    WHEN controlling.f_db_stufe(konto) = 0                     THEN 'ertrag'
    WHEN controlling.f_klr_typ(konto) = 'ZINSEN'               THEN 'finanz'
    WHEN controlling.f_klr_typ(konto) = 'STEUERN'              THEN 'steuern'
    WHEN controlling.f_klr_typ(konto) IN ('NEUTRALER_ERTRAG','NEUTRALER_AUFWAND','KALKULATORISCH')
                                                               THEN 'neutral'
    WHEN controlling.f_klr_typ(konto) = 'ABSCHREIBUNG'         THEN 'afa'
    ELSE 'aufwand'
  END;
$$;

CREATE OR REPLACE FUNCTION controlling.f_sortierung(konto integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE left(controlling.f_guv_gruppe(konto), position(' ' in controlling.f_guv_gruppe(konto)) - 1)
    WHEN '1' THEN 10 WHEN '2' THEN 20 WHEN '3' THEN 30 WHEN '4' THEN 40
    WHEN '5' THEN 50 WHEN '6' THEN 60 WHEN '7' THEN 70 WHEN '8' THEN 80
    WHEN '9' THEN 90 WHEN '10' THEN 100 WHEN '11' THEN 110 WHEN '12' THEN 120
    ELSE 999 END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Klassifizierung anwenden
--    Nach jedem Import erneut aufrufen, damit neue Konten eingeordnet werden.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE PROCEDURE controlling.kostenarten_klassifizieren()
LANGUAGE sql AS $$
  UPDATE controlling.kostenarten
     SET kontonummer = round(kostenart_nr::numeric)::int
   WHERE kostenart_nr ~ '^[0-9.]+$'
     AND kontonummer IS DISTINCT FROM round(kostenart_nr::numeric)::int;

  UPDATE controlling.kostenarten SET
    db_stufe     = controlling.f_db_stufe(kontonummer),
    variabel     = (controlling.f_db_stufe(kontonummer) = 1),
    einzelkosten = controlling.f_einzelkosten(kontonummer),
    klr_typ      = controlling.f_klr_typ(kontonummer),
    klr_gruppe   = controlling.f_klr_gruppe(kontonummer),
    guv_gruppe   = controlling.f_guv_gruppe(kontonummer),
    sortierung   = controlling.f_sortierung(kontonummer)
  WHERE kontonummer IS NOT NULL;

  /* Merkmale, die der TVF-Kontenstamm liefert, werden nur dort abgeleitet,
     wo kein Stammsatz vorliegt – 03_kontenstamm.sql darf nicht ueberschrieben werden. */
  UPDATE controlling.kostenarten SET
    kontoart        = controlling.f_kontoart(kontonummer),
    planungsgruppe  = COALESCE(planungsgruppe, klr_gruppe),
    ebitda_relevant = (controlling.f_db_stufe(kontonummer) IN (0,1,2)
                       AND controlling.f_klr_typ(kontonummer) <> 'ABSCHREIBUNG'),
    quelle          = 'aus Nummernkreis hergeleitet'
  WHERE kontonummer IS NOT NULL
    AND quelle IS DISTINCT FROM 'TVF-Kontenstamm';
$$;

CALL controlling.kostenarten_klassifizieren();

-- ---------------------------------------------------------------------------
-- 6. Indizes fuer die Auswertungen
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_buchungen_periode   ON controlling.buchungen(geschaeftsjahr,periode);
CREATE INDEX IF NOT EXISTS idx_buchungen_auftrag   ON controlling.buchungen(auftrag);
CREATE INDEX IF NOT EXISTS idx_buchungen_kostenart ON controlling.buchungen(kostenart);
CREATE INDEX IF NOT EXISTS idx_projekte_region     ON controlling.projekte(regionscode);

COMMIT;
