# DidYouKnow Component

A popover component that displays tips and hints to users. The popover appears near the mouse cursor after a configurable delay, showing tips one at a time.

## Usage

```astro
---
import DidYouKnow from '~/components/DidYouKnow.astro';
---

<DidYouKnow id="unique-tip-id" message="This is a helpful tip!" />
```

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `id` | `string` | Yes | - | Unique identifier for the tip. Used to track dismissed tips in localStorage. |
| `message` | `string` | Yes | - | The message to display in the popover. |
| `delay` | `number` | No | `3000` | Delay in milliseconds before showing the popover. |

## Examples

### Basic usage

```astro
<DidYouKnow id="welcome" message="Welcome to the documentation!" />
```

### Custom delay

```astro
<DidYouKnow id="slow-tip" message="This tip appears after 5 seconds" delay={5000} />
```

### Multiple tips

When multiple `DidYouKnow` components are on a page, they will be shown one at a time. After the user dismisses a tip, the next one will appear (after its configured delay).

```astro
<DidYouKnow id="tip-1" message="First tip" delay={2000} />
<DidYouKnow id="tip-2" message="Second tip" delay={3000} />
<DidYouKnow id="tip-3" message="Third tip" delay={1000} />
```

## Behavior

1. **Positioning**: The popover appears near the mouse cursor. If no mouse movement has been detected, it centers on the screen.

2. **Dismissal**: Users can close the popover by clicking the X button. Dismissed tips are remembered in `localStorage` under the key `didyouknow-dismissed`.

3. **Sequential display**: Only one tip is shown at a time. After dismissing a tip, the next non-dismissed tip will be scheduled.

4. **Viewport awareness**: The popover automatically adjusts its position to stay within the viewport boundaries.

## File Structure

- `src/components/DidYouKnow.astro` - The Astro component
- `src/scripts/did-you-know.ts` - The controller script that manages popover display and positioning

## Styling

The component uses Starlight CSS variables for theming:

- `--sl-color-bg` - Background color
- `--sl-color-accent` - Border and hover colors
- `--sl-color-accent-high` - Label text color
- `--sl-color-text` - Message text color
- `--sl-color-text-accent` - Close button color

## localStorage

Dismissed tip IDs are stored in `localStorage` under the key `didyouknow-dismissed` as a JSON array:

```json
["tip-1", "tip-2"]
```

To reset all dismissed tips (for testing), run in the browser console:

```javascript
localStorage.removeItem('didyouknow-dismissed');
```
