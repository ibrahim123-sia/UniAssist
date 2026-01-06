import os
import groq

print(f"Groq file: {groq.__file__}")

# Check file content
file_path = groq.__file__
with open(file_path, 'r') as f:
    content = f.read()
    
# Look for proxies
if 'ProxiesTypes' in content:
    print("❌ ERROR: File contains 'ProxiesTypes' (WRONG VERSION)")
    print("This is Groq >=0.10.0, not 0.9.0")
    
    # Show first few lines
    lines = content.split('\n')[:20]
    print("\nFile preview:")
    for line in lines:
        print(line)
else:
    print("✅ File looks correct (0.9.0 or earlier)")

# Check what's actually in the module
print(f"\nGroq module contents:")
for item in dir(groq):
    if not item.startswith('_'):
        print(f"  {item}")