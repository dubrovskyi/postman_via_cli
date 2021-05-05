pipeline {
    agent any
    stages {
        stage('get_project') {
            steps {
                echo "get project from git"
                git changelog: false, credentialsId: '<creds_id>', poll: false, url: '<https://github.com/dubrovskyi/postman_via_cli.git>'
            }
        }
        stage('run_project'){
            steps {
                   echo "run newman"
                   sh label: '', script: 'start.sh <collection.json> <environment.json>'
            }
        }
        stage('html report') {
            steps {
                    echo "html report"
                    publishHTML([allowMissing: false, alwaysLinkToLastBuild: false, keepAll: false, reportDir: '', reportFiles: 'htmlResults.html', reportName: 'HTML Report', reportTitles: 'html'])
            }
    }
}
}
