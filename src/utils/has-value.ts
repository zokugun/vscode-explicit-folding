export function hasValue(object: Object | undefined): boolean {
	if(!object) {
		return false;
	}

	for(const key in object) {
		if(Object.prototype.hasOwnProperty.call(object, key)) {
			return true;
		}
	}

	return false;
}
