       IDENTIFICATION DIVISION.
       PROGRAM-ID. MYPROG.
       DATE-COMPILED.
       ENVIRONMENT Division.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER. IBM-370.
       OBJECT-COMPUTER. IBM-370.
       INPUT-OUTPUT section.
       FILE-CONTROL.
            select DD-FICHIER assign to UT-S-DD.
       DATA division.
       FILE SeCtIoN.
       FD  DD-FICHIER
           block contains 0 records
           recording mode is F.
           copy DDCOPY.
       WORKING-STORAGE SECTION.
       01  ADATA       PIC X(1).
       LINKAGE SECTION.
       01  APARM       PIC X(10).
       PROCEDURE divisioN using APARM.
       MAIN SECTION.
       START-OF-RUN.
           display "Hello World !"
           .
       END-OF-RUN.
           goback.
