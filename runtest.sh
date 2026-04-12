#!/bin/bash
if [ -z "$1" ]; then
  echo "Usage: ./runtest.sh <test-name>"
  echo "Example: ./runtest.sh explorer"
  exit 1
fi

npx tsx "src/test-${1}.ts"
