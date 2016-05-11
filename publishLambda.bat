del backendEMC.zip 
7z a -r backendEMC.zip index.js
aws lambda update-function-code --function-name backendEMC --zip-file fileb://backendEMC.zip
