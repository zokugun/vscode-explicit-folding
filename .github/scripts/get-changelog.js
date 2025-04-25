const fs = require('fs');
const path = require('path');

// Get version from command line argument (with 'v' prefix)
const version = process.argv[2];

try {
	const changelog = fs.readFileSync(path.join(process.cwd(), 'CHANGELOG.md'), 'utf8');

	// Regular expression to match a version section with the date
	// Matches from "## v0.8.1 | 2025-04-23" until the next ## or end of file
	const versionRegex = new RegExp(`## ${version} \\| \\d{4}-\\d{2}-\\d{2}[^#]*(?=## |$)`, 's');

	const match = changelog.match(versionRegex);

	if(match) {
		// Remove the version header and trim whitespace
		const notes = match[0].replace(/^## v\d+\.\d+\.\d+ \| \d{4}-\d{2}-\d{2}\n/, '').trim();
		console.log(notes);
		process.exit(0);
	}
	else {
		console.error(`No changelog entry found for version ${version}`);
		process.exit(1);
	}
}
catch(error) {
	console.error('Error reading CHANGELOG.md:', error);
	process.exit(1);
}
