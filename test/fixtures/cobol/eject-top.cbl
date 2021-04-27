      / page eject
       IDENTIFICATION DIVISION.
       PROGRAM-ID. MYPROG.
       DATE-COMPILED.
       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.
       SOURCE-COMPUTER. IBM-370.
       OBJECT-COMPUTER. IBM-370.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
            select DD-FICHIER assign to UT-S-DD.
       DATA DIVISION.
       FILE SECTION.
       FD  DD-FICHIER
           block contains 0 records
           recording mode is F.
           copy DDCOPY.
       WORKING-STORAGE SECTION.
       01  ADATA       PIC X(1).
       LINKAGE SECTION.
       01  APARM       PIC X(10).
       PROCEDURE DIVISION using APARM.
       MAIN SECTION.
       START-OF-RUN.
           display "Hello World !"
           .
       END-OF-RUN.
           goback.
