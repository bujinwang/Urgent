import re

html_content = open('index.html', 'r').read()
css_content = open('assets/style.css', 'r').read()
js_content = open('assets/app.js', 'r').read()

classes_in_html = set(re.findall(r'class="([^"]+)"', html_content))
all_html_classes = set()
for c in classes_in_html:
    all_html_classes.update(c.split())

funcs_in_html = set(re.findall(r'onclick="([^"(]+)', html_content))

missing_css = []
for c in all_html_classes:
    if not re.search(r'\.' + c + r'\b', css_content):
        missing_css.append(c)

missing_js = []
for f in funcs_in_html:
    if f not in ['location.href', 'history.back', 'event.stopPropagation', 'console.log'] and not re.search(r'function\s+' + f + r'\b', js_content) and not re.search(f + r'\s*=', js_content):
        missing_js.append(f)

print("Missing CSS classes (Potential):", sorted(missing_css))
print("Missing JS functions:", sorted(missing_js))
