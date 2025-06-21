# Styles Used

## Ramona Image

The Ramona Image style creates an overlay effect with a semi-transparent information card positioned at the bottom-right corner of an image container.

### Implementation

**HTML Structure:**
```html
<div class="members-catalog">
    <img src="image.jpg" class="img-fluid shadow">
    <div class="overlay-stat">
        <h3>84+</h3>
        <p>Expert Members</p>
    </div>
</div>
```

**CSS Implementation:**
```css
.members-catalog {
    position: relative;
    overflow: hidden;
}

.members-catalog .overlay-stat {
    position: absolute;
    bottom: 20px;
    right: 20px;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(10px);
    border-radius: 15px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(233, 30, 99, 0.2);
}
```

**Key Features:**
- Relative positioning on parent container
- Absolute positioning for overlay at bottom-right
- Semi-transparent background (50% opacity)
- Backdrop blur filter for glassmorphism effect
- Rounded corners (15px border-radius)
- Subtle shadow and pink accent border
