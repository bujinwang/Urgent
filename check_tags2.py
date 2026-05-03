with open("/Users/bujin/Documents/Projects/Urgent/急救侠_H5_Demo_v17.html", "r") as f:
    content = f.read()

for tag in ["script", "style", "textarea", "template", "xmp", "noscript"]:
    open_count = content.count(f"<{tag}>") + content.count(f"<{tag} ")
    close_count = content.count(f"</{tag}>")
    if open_count != close_count:
        print(f"Mismatched {tag}: {open_count} open, {close_count} close")
