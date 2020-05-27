const newman = require('newman');

const collection = process.argv[2];
const coll_env = process.argv[3];

newman.run({
    collection: require('./' + collection), // can also provide a URL or path to a local JSON file.
    environment: require('./' + coll_env),
    reporters: 'htmlextra',
    reporter: {
        htmlextra: {
            export: './htmlResults.html', // If not specified, the file will be written to `newman/` in the current working directory.
            darkTheme: true
        }
    }
}, function (err) {
    if (err) { throw err; }
    console.log('collection run complete!');
});
