//MYJOB    JOB ,'MY JOB',CLASS=A,NOTIFY=&SYSUID
//****
//* COMMENTS
//****
//MYPROC   PROC P1='P1',
//         P2='P2'
//MYSTEP   EXEC PGM=MYPROG
//STEPLIB  DD DISP=SHR,DSN=MY.LOADLIB
//IN       DD DISP=SHR,DSN=&P1
//OUT      DD DSN=&P2,
//            DISP=(NEW,CATLG),
//            SPACE=(CYL,(5,5),RLSE)
//MYPROC   PEND
//*
//STEP     EXEC PROC=MYPROC,
//              P1='MY.FIC.ALPHA',
//              P2='MY.FIC.BETA'
//* That's all
