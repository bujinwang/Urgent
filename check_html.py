from html.parser import HTMLParser

class MyHTMLParser(HTMLParser):
    def handle_starttag(self, tag, attrs):
        pass
    def handle_endtag(self, tag):
        pass
    def handle_data(self, data):
        pass

parser = MyHTMLParser()
with open("/Users/bujin/Documents/Projects/Urgent/急救侠_H5_Demo_v17.html", "r") as f:
    try:
        parser.feed(f.read())
        print("HTML parsed successfully.")
    except Exception as e:
        print(f"HTML parsing failed: {e}")
