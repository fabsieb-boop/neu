/* ---------------------------------------------------------------------------
   Der Referenz-Personalaufwand war zu niedrig
   ---------------------------------------------------------------------------
   guv_referenz fuehrte den Personalaufwand Januar bis Juli mit 2.489.311,70.
   Der SAP-Bericht sagt 2.671.099,13, und die Praesentation auf Folie 22
   ebenso.  Die Differenz sind 181.787,43 - Konto 411021, Arbeitgeberanteil
   zur gesetzlichen Rentenversicherung.  Es lag im Auffangtopf 0080000000
   des alten Berichtsstands und fehlte deshalb ueberall.

   04_referenzen.sql seedet nur noch, was fehlt - aus gutem Grund, sonst
   setzt jeder db:setup gepflegte Staende zurueck.  Ein vorhandener, aber
   falscher Wert wird davon allerdings auch nicht mehr berichtigt.  Das
   erledigt diese Migration, einmal und nachvollziehbar.
--------------------------------------------------------------------------- */

UPDATE controlling.guv_referenz
   SET betrag = -2671099.13
 WHERE jahr = 2026 AND szenario = 'ist' AND position = 'personal'
   AND betrag <> -2671099.13;

/* Die Staffel muss auf ihr eigenes Ergebnis kommen: was beim Personalaufwand
   fehlte, fehlte auch unten.  -90.659,26 - 181.787,43 = -272.446,69. */
UPDATE controlling.guv_referenz
   SET betrag = -272446.69
 WHERE jahr = 2026 AND szenario = 'ist' AND position = 'ergebnisVorSteuern'
   AND betrag <> -272446.69;
