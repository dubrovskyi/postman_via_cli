#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const newman = require('newman');

const USAGE = `
Run a Postman collection from the CLI / CI.

Usage:
  node start.js <collection> [environment] [options]
  node start.js --collection <file|url> [--environment <file|url>] [options]

Options:
  -c, --collection <file|url>   Postman collection (required)
  -e, --environment <file|url>  Postman environment
  -g, --globals <file|url>      Postman globals
  -d, --iteration-data <file>   CSV/JSON data file for data-driven runs
  -n, --iterations <number>     Number of iterations (default 1)
      --folder <name>           Run only this folder/request (repeatable)
      --reporters <list>        Comma separated (default: cli,htmlextra,allure)
      --report-dir <dir>        Where reports are written (default: reports)
      --timeout-request <ms>    Per request timeout (default 30000)
      --delay-request <ms>      Delay between requests (default 0)
      --bail                    Stop the run on the first failure
      --insecure                Disable strict SSL
  -h, --help                    Show this help

Examples:
  node start.js collections/postman-echo.postman_collection.json
  node start.js -c collections/api.json -e environments/stage.json --bail
  npm start -- -c collections/api.json --reporters cli,junit
`;

const WITH_VALUE = new Set([
    'collection', 'environment', 'globals', 'iteration-data', 'iterations',
    'folder', 'reporters', 'report-dir', 'timeout-request', 'delay-request',
]);

const ALIASES = {
    c: 'collection',
    e: 'environment',
    g: 'globals',
    d: 'iteration-data',
    n: 'iterations',
    h: 'help',
};

function parseArgs(argv) {
    const opts = { folder: [], _: [] };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];

        if (arg === '--') {
            opts._.push(...argv.slice(i + 1));
            break;
        }

        if (!arg.startsWith('-')) {
            opts._.push(arg);
            continue;
        }

        // --key=value / --key value / -k value
        let [key, inlineValue] = arg.replace(/^--?/, '').split(/=(.*)/s);
        key = ALIASES[key] || key;

        if (WITH_VALUE.has(key)) {
            const value = inlineValue !== undefined ? inlineValue : argv[++i];
            if (value === undefined) {
                fail(`Option --${key} needs a value`);
            }
            if (key === 'folder') {
                opts.folder.push(value);
            } else {
                opts[key] = value;
            }
            continue;
        }

        opts[key] = true;
    }

    // Backwards compatible positional form: <collection> <environment>
    if (!opts.collection && opts._[0]) { opts.collection = opts._[0]; }
    if (!opts.environment && opts._[1]) { opts.environment = opts._[1]; }

    return opts;
}

function fail(message) {
    console.error(`\nError: ${message}`);
    console.error(USAGE);
    process.exit(2);
}

function isUrl(value) {
    return /^https?:\/\//i.test(value);
}

/**
 * Newman accepts a URL or a filesystem path as a plain string. Resolving the
 * path here (instead of require()-ing it) keeps absolute paths, paths outside
 * the project and remote URLs all working.
 */
function resolveSource(value, label) {
    if (isUrl(value)) { return value; }

    const resolved = path.resolve(process.cwd(), value);
    if (!fs.existsSync(resolved)) {
        fail(`${label} not found: ${value}`);
    }
    return resolved;
}

function toPositiveInt(value, label) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        fail(`${label} must be a non-negative integer, got "${value}"`);
    }
    return parsed;
}

function buildRunOptions(opts) {
    if (opts.help) {
        console.log(USAGE);
        process.exit(0);
    }

    if (!opts.collection) {
        fail('No collection supplied');
    }

    const reportDir = path.resolve(process.cwd(), opts['report-dir'] || 'reports');
    const reporters = (opts.reporters || 'cli,htmlextra,allure')
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);

    fs.mkdirSync(reportDir, { recursive: true });

    const runOptions = {
        collection: resolveSource(opts.collection, 'Collection'),
        reporters,
        bail: Boolean(opts.bail),
        insecure: Boolean(opts.insecure),
        timeoutRequest: toPositiveInt(opts['timeout-request'] || 30000, '--timeout-request'),
        delayRequest: toPositiveInt(opts['delay-request'] || 0, '--delay-request'),
        reporter: {
            htmlextra: {
                export: path.join(reportDir, 'htmlResults.html'),
                darkTheme: true,
            },
            // newman-reporter-allure 3.x names this `resultsDir`, not `export`.
            allure: {
                resultsDir: path.join(reportDir, 'allure-results'),
            },
            junit: {
                export: path.join(reportDir, 'junitResults.xml'),
            },
        },
    };

    if (opts.environment) {
        runOptions.environment = resolveSource(opts.environment, 'Environment');
    }
    if (opts.globals) {
        runOptions.globals = resolveSource(opts.globals, 'Globals');
    }
    if (opts['iteration-data']) {
        runOptions.iterationData = resolveSource(opts['iteration-data'], 'Iteration data');
    }
    if (opts.iterations) {
        runOptions.iterationCount = toPositiveInt(opts.iterations, '--iterations');
    }
    if (opts.folder.length) {
        runOptions.folder = opts.folder;
    }

    return { runOptions, reportDir };
}

function main() {
    const { runOptions, reportDir } = buildRunOptions(parseArgs(process.argv.slice(2)));

    newman.run(runOptions)
        .on('start', () => {
            console.log(`running collection: ${runOptions.collection}`);
            if (runOptions.environment) {
                console.log(`with environment: ${runOptions.environment}`);
            }
        })
        .on('done', (err, summary) => {
            const failures = (summary && summary.run && summary.run.failures) || [];

            if (err || !summary || summary.error || failures.length) {
                console.error(`collection run failed (${failures.length} assertion failure(s))`);
                if (err || (summary && summary.error)) {
                    console.error(String((err || summary.error).message || err || summary.error));
                }
                // Set the code instead of calling process.exit() so reporters
                // can finish flushing their files before the process ends.
                process.exitCode = 1;
                return;
            }

            console.log(`collection run completed, reports in ${reportDir}`);
        });
}

main();
