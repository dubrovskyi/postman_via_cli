#!/bin/bash
# set variables
FILE=htmlResults.html
DIR=node_modules

if [ $# -lt 2 ]
  then
    echo "Seems like you supplied not enough arguments"
    exit 1
fi

echo "check if node_modules dir exists"
if [ ! -d $DIR ]; then
  npm install  
fi

echo "check if htmlResults file exists"
if [ -f $FILE ]; then
  rm $FILE
fi

echo "run tests"
npm run start $@

# echo "run report in firefox"
# firefox $FILE
