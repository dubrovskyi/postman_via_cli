#!/bin/bash

# set variables
FILE=htmlResults.html
DIR=node_modules

echo "check if node_modules dir exists"
if [ ! -d $DIR ]; then
  npm install  
fi

echo "check if htmlResults file exists"
if [ -f $FILE ]; then
  rm $FILE
fi

echo "run tests"
npm run start $1 $2

# echo "run report in firefox"
# firefox $FILE