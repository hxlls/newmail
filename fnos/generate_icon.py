#!/usr/bin/env python3
"""Generate simple PNG icon for NewMail fnos app"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("需要安装 Pillow: pip install Pillow")
    print("或者手动创建 icon.png (128x128 和 256x256)")
    exit(1)

def create_icon(size, output_path):
    # 创建蓝色背景
    img = Image.new('RGB', (size, size), color='#4A90D9')
    draw = ImageDraw.Draw(img)
    
    # 绘制白色文字 "NM"
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size // 3)
    except:
        font = ImageFont.load_default()
    
    text = "NM"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (size - text_width) // 2
    y = (size - text_height) // 2
    
    draw.text((x, y), text, fill='white', font=font)
    
    img.save(output_path)
    print(f"Created: {output_path}")

if __name__ == '__main__':
    create_icon(128, 'icon.png')
    create_icon(256, 'icon_256.png')
