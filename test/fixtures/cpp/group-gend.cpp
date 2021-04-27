#begin foo   // beginRegex matches this line
blah blah
}}}
#end
#end bar     // endRegex does not match this line
#end foo     // endRegex matches this line
