import path from 'path';
import Mocha from 'mocha';
import glob from 'glob';

export async function run(): Promise<void> {
	// Create the mocha test
	const mocha = new Mocha({
		color: true,
	});

	const testsRoot = path.resolve(__dirname, '..');

	return new Promise((resolve, reject) => {
		glob('**/**.test.js', { cwd: testsRoot }, (error, files) => {
			if(error) {
				reject(error);
			}

			// Add files to the test suite
			for(const f of files) {
				mocha.addFile(path.resolve(testsRoot, f));
			}

			try {
				// Run the mocha test
				mocha.run((failures) => {
					if(failures > 0) {
						reject(new Error(`${failures} tests failed.`));
					}
					else {
						resolve();
					}
				});
			}
			catch (error: unknown) {
				reject(error);
			}
		});
	});
}
