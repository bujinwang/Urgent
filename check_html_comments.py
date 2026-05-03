with open("/Users/bujin/Documents/Projects/Urgent/急救侠_H5_Demo_v17.html", "r") as f:
    content = f.read()

open_comments = content.count("<!--")
close_comments = content.count("-->")

print(f"Open HTML comments: {open_comments}")
print(f"Close HTML comments: {close_comments}")
