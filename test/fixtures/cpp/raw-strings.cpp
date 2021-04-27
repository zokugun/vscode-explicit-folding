<1>
(  folding starts here
123
)  folding ends here

<2>
"("
this is not folded
")"

<3>
R"123(  folding starts here
foo
)"  this doesn't end folding
bar
)123"  folding ends here

this is the part the doesn't work:
<4>
(  folding starts here
    123
    ()""
    456
)  folding ends here

<5>
{  folding starts here
123
//  }
456
}  folding ends here
