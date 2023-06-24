#!/bin/bash
# Download the file from the provided URL
curl -o links.txt https://raw.githubusercontent.com/yebekhe/TelegramV2rayCollector/main/sub/reality
# Initialize a counter variable
counter=1
# Loop through each line in the file
while read -r line; do
    # Replace the text after the '#' character with "AZADI-X"
    new_line=$(echo "$line" | sed "s/#.*/#🏳SAJED(AZADI)-$counter/")
    # Increment the counter variable
    ((counter++))
    # Print the modified line
    echo "$new_line"
done < links.txt > new_links-$counter
