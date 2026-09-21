pipeline {
    agent any

    parameters {
        string(name: 'COLLECTION', defaultValue: 'collections/postman-echo.postman_collection.json', description: 'Collection to run')
        string(name: 'ENVIRONMENT', defaultValue: 'environments/postman-echo.postman_environment.json', description: 'Environment file, leave empty to run without one')
        booleanParam(name: 'BAIL', defaultValue: false, description: 'Stop on the first failure')
    }

    options {
        timeout(time: 20, unit: 'MINUTES')
    }

    stages {
        stage('checkout') {
            steps {
                checkout scm
            }
        }

        stage('install') {
            steps {
                sh 'npm ci'
            }
        }

        stage('run newman') {
            steps {
                sh '''
                    set -eu
                    args="--collection ${COLLECTION} --reporters cli,htmlextra,allure,junit"
                    if [ -n "${ENVIRONMENT}" ]; then
                        args="${args} --environment ${ENVIRONMENT}"
                    fi
                    if [ "${BAIL}" = "true" ]; then
                        args="${args} --bail"
                    fi
                    node start.js ${args}
                '''
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'reports/junitResults.xml'
            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'reports',
                reportFiles: 'htmlResults.html',
                reportName: 'Newman HTML Report'
            ])
            allure includeProperties: false, jdk: '', results: [[path: 'reports/allure-results']]
            archiveArtifacts artifacts: 'reports/**', allowEmptyArchive: true
        }
    }
}
