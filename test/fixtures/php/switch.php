<?php

function methodOne($var) {
	switch ($var) {
		case 'hi':
		case 'hi2':
			echo 'hi';
			break;
		case 'hello2':
			echo 'something else';
		case 'hello':
			echo 'hello';
			break;
		default:
			echo 'nothing';
	}
}

function methodTwo($var) {
	switch ($var) {
		case 'bye':
			echo 'bye';
			break;
		case 'see ya':
			echo 'see ya';
			break;
		default:
			echo 'nothing again';
			break;
	}
}
