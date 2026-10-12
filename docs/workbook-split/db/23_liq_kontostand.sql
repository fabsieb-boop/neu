-- Wöchentliche Kontostände von Hand.
-- Der Stichtag ist das Ende der Kalenderwoche aus v_liq_woche (Spalte bis).
-- Die Summe der Konten wird gegen den Plan-Saldo derselben Woche gestellt.
-- Diese Tabelle schreibt weder den Liquiditätsplan noch die Bankbewegungen fort.

CREATE TABLE IF NOT EXISTS controlling.liq_kontostand (
  stichtag date NOT NULL,
  konto text NOT NULL CHECK (length(btrim(konto)) > 0),
  saldo numeric(18,2) NOT NULL,
  erfasst_am timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stichtag, konto)
);
