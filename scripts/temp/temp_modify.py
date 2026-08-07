import re

file_path = r'E:\new\siios\js\apps\youtube\index.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add import if not exists
import_line = "import { buildAppContext } from '../../core/app-context-builder.js';"
if 'buildAppContext' not in content:
    content = content.replace(
        "import APIClient from '../../api.js';",
        "import APIClient from '../../api.js';\n" + import_line
    )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Import added successfully')
