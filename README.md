# Postman via CLI

Run Postman collections from the command line and on CI, with HTML and Allure reports.

You export a collection from Postman, drop it into `collections/`, and the same
command runs it locally and in the pipeline.

## Requirements

- Node.js 18+ (https://nodejs.org)

## Quick start

```bash
npm ci
./start.sh collections/postman-echo.postman_collection.json environments/postman-echo.postman_environment.json
```

The wrapper installs dependencies on first run, wipes the previous reports and
runs the collection. The demo collection hits postman-echo.com, so a green run
means the whole chain works.

## Adding your own collection

1. In Postman: **Collection → ... → Export → v2.1** and save it to `collections/`.
2. Optionally export the environment as well into `environments/`.
3. Run it:

```bash
./start.sh collections/my-api.postman_collection.json environments/stage.postman_environment.json
```

Anything that is not a secret can live in the repo. Keep tokens and passwords
out of the environment file and inject them as variables instead (see CI below).

## Options

`start.sh` forwards everything to `start.js`:

```
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
```

Examples:

```bash
# run a single folder, twice, stop on first failure
./start.sh -c collections/my-api.postman_collection.json --folder smoke -n 2 --bail

# run a collection published by URL, add a junit report for CI
./start.sh -c https://example.com/my.postman_collection.json --reporters cli,junit

# data driven run
./start.sh -c collections/my-api.postman_collection.json -d data/users.csv
```

The exit code is `0` when every assertion passes, `1` when the run has failures
(so CI goes red), and `2` on a usage error such as a missing file.

## Reports

Everything lands in `reports/` (git-ignored):

| File | What it is |
| --- | --- |
| `reports/htmlResults.html` | standalone HTML report, open it in a browser |
| `reports/allure-results/` | raw Allure results |
| `reports/junitResults.xml` | JUnit XML, when `junit` is in `--reporters` |

To view the Allure report:

```bash
npm run allure:generate
npm run allure:open
```

## CI

`.github/workflows/newman.yml` runs the collection on every push to `master`,
on pull requests, nightly at 03:00 UTC, and on demand.

To run it manually against another collection: **Actions → newman → Run
workflow**, then fill in the collection and environment paths.

Reports are uploaded as build artifacts for 30 days, including for failed runs,
and the assertion results are published to the run summary.

### Secrets

Do not commit tokens. Add them as repository secrets and pass them into the run,
for example:

```yaml
      - name: Run collection
        env:
          API_TOKEN: ${{ secrets.API_TOKEN }}
        run: node start.js -c collections/my-api.postman_collection.json --reporters cli,junit
```

Then read the value in a pre-request script with `pm.environment.get` after
seeding it, or reference it through a Postman variable populated from the
environment.

### Jenkins

`Jenkinsfile` covers the same run for a Jenkins instance. It is parameterised
(`COLLECTION`, `ENVIRONMENT`), publishes the HTML report and needs the
HTML Publisher and Allure plugins.
