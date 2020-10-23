const newman = require('newman');

const collection = process.argv[2];
const coll_env = process.argv[3];

newman.run({
    collection: require('./' + collection), // can also provide a URL or path to a local JSON file.
    environment: require('./' + coll_env),
    reporters: ['htmlextra','allure'],
    reporter: {
        htmlextra: {
            export: './htmlResults.html', // If not specified, the file will be written to `newman/` in the current working directory.
            darkTheme: true
        },
        allure: {
            export: 'results/allure'
        }
    }
}).on('start', function (err, args) { // on start of run, log to console
    console.log('running a collection...');
}).on('done', function (err, summary) {
    if (err || summary.error || summary.run.failures.length > 0) {

        console.error('collection run encountered an error.');
        process.exit(1);
    }
    else {
        console.log('collection run completed.');
    }
});
