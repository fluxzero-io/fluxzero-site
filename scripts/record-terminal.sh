
#!/bin/bash
###
### Script to record a terminal session and convert it to a GIF
### Requires 
### - asciinema (install with `brew install asciinema`)
### - asciicast2gif (install with `npm install -g asciicast2gif`)
### 
### Usage:
### 1. Make the script executable: `chmod +x record-terminal.sh`
### 2. Choose a clean directory like `/tmp/fluxzero` to execute your commands
### 3. Run the script: `{path_to_this_repo}/scripts/record-terminal.sh [filename]`
###    - If filename is provided: generates `filename.gif`
###    - If no filename: generates `recording.gif`
### 4. After recording, the GIF will be created in the same directory

# Set desired terminal dimensions (change these as needed)
DESIRED_COLS=80
DESIRED_ROWS=15

# Get output filename from first argument, default to "recording.gif"
OUTPUT_FILE="${1:-recording}.gif"

clear
rm -f /tmp/terminal.cast /tmp/clean.cast

# Try to resize terminal to desired dimensions
printf '\e[8;%d;%dt' "$DESIRED_ROWS" "$DESIRED_COLS"
sleep 0.5  # Give terminal time to resize

# Get actual terminal dimensions after resize attempt
COLS=$(tput cols 2>/dev/null)
ROWS=$(tput lines 2>/dev/null)

# If tput failed or dimensions are wrong, use desired dimensions
if [ -z "$COLS" ] || [ "$COLS" -le 0 ]; then
    COLS="$DESIRED_COLS"
fi
if [ -z "$ROWS" ] || [ "$ROWS" -le 0 ]; then
    ROWS="$DESIRED_ROWS"
fi

asciinema rec -q /tmp/terminal.cast

# Only clean if terminal.cast contains "Saving session..."
if grep -q "Saving session..." /tmp/terminal.cast; then
    sed '2d' /tmp/terminal.cast | sed '$d' | sed '$d' > /tmp/clean.cast
else
    cp /tmp/terminal.cast /tmp/clean.cast
fi

# Always extract actual dimensions from cast file as authoritative source
echo "Extracting actual dimensions from cast file..."
# The second line contains the JSON header with width/height
HEADER_LINE=$(head -n 1 /tmp/clean.cast)
CAST_COLS=$(echo "$HEADER_LINE" | grep -o '"width": *[0-9]*' | grep -o '[0-9]*')
CAST_ROWS=$(echo "$HEADER_LINE" | grep -o '"height": *[0-9]*' | grep -o '[0-9]*')

# Use actual dimensions from cast file if we got valid values
if [ -n "$CAST_COLS" ] && [ -n "$CAST_ROWS" ] && [ "$CAST_COLS" -gt 0 ] && [ "$CAST_ROWS" -gt 0 ]; then
    COLS="$CAST_COLS"
    ROWS="$CAST_ROWS"
    echo "Using actual dimensions from cast file: ${COLS}x${ROWS}"
else
    echo "Could not extract valid dimensions from cast file, using fallback: ${COLS}x${ROWS}"
    echo "Header line was: $HEADER_LINE"
fi

# Debug output
echo "Terminal dimensions: ${COLS}x${ROWS}"
echo "Generating GIF: $OUTPUT_FILE"

# Ensure we have valid numbers
COLS=${COLS:-80}
ROWS=${ROWS:-20}

asciicast2gif -s 1 -t solarized-dark -w "$COLS" -h "$ROWS" /tmp/clean.cast "$OUTPUT_FILE"