tell application "Microsoft Word"
    try
        if (count of documents) > 0 then
            set docName to name of active document
            set AppleScript's text item delimiters to "."
            set nameItems to text items of docName
            if (count of nameItems) > 1 then
                set nameWithoutExt to (items 1 thru -2 of nameItems) as text
            else
                set nameWithoutExt to docName
            end if
            set AppleScript's text item delimiters to ""

            -- Strip .merged_\d+ suffix and replace underscores via shell
            set nameWithoutExt to do shell script "printf '%s' " & quoted form of nameWithoutExt & " | sed 's/\\.merged_[0-9]*$//' | tr '_' ' '"

            set the clipboard to nameWithoutExt
        end if
    on error errMsg
        display alert "Error: " & errMsg
    end try
end tell
