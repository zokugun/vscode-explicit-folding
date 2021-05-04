<?php
function methodOne($something) {
	if ($something) {
		$something_else = "a string with {$something['key']} in it";
	}

	return $something_else;
}
