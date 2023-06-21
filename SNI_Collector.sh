#!/bin/bash

# Download the file from the provided URL
curl -o links.txt https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/reality

# Extract the SNI values from the links and save them to a file
sed -n 's/.*sni=\([^&]*\).*/\1/p' links.txt > sni_values.txt

# Print the unique SNI values
sort -u sni_values.txt
