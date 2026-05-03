with open("/Users/bujin/Documents/Projects/Urgent/急救侠_H5_Demo_v17.html", "r") as f:
    content = f.read()

style_start = content.find("<style>")
style_end = content.find("</style>")

css_content = content[style_start+7:style_end]

open_parens = css_content.count("(")
close_parens = css_content.count(")")

print(f"Open parens: {open_parens}")
print(f"Close parens: {close_parens}")
