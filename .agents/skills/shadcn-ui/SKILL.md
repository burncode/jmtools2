---
name: shadcn-ui
description: Efficiently add, configure, and use shadcn/ui components. Use this skill when the user wants to add UI components, fix styling, or needs the list of available shadcn components.
---

# shadcn/ui Skill

This skill enables Claude to manage shadcn/ui components using the official CLI and best practices.

## Core Commands
- **Initialize:** `npx shadcn@latest init`
- **Add Component:** `npx shadcn@latest add [component-name]`
- **List All:** `npx shadcn@latest add` (shows interactive list)

## Available Components
When a user asks for a UI element, use `npx shadcn@latest add` for any of the following:
- Accordion, Alert, Alert Dialog, Aspect Ratio, Avatar
- Badge, Breadcrumb, Button, Button Group
- Calendar, Card, Carousel, Chart, Checkbox, Collapsible, Combobox, Command, Context Menu
- Data Table, Date Picker, Dialog, Drawer, Dropdown Menu
- Form, Hover Card, Input, Input OTP, Label, Menubar, Navigation Menu
- Pagination, Popover, Progress, Radio Group, Resizable, Scroll Area, Select, Separator, Sheet, Sidebar, Skeleton, Slider, Sonner, Switch
- Table, Tabs, Textarea, Toast, Toggle, Toggle Group, Tooltip, Typography

## Usage Guidelines
1. **Theming:** Prefer using CSS Variables for theming unless the project is strictly utility-class based.
2. **Path Aliases:** Always check `components.json` or `tsconfig.json` to ensure components are imported from the correct alias (default is `@/components/ui/...`).
3. **Forms:** When adding `Form`, remind the user it integrates with `react-hook-form` and `zod`.
4. **Icons:** Use `lucide-react` by default for component icons.

## Workflows
- **New Component:** Run `npx shadcn@latest add <name>`, then implement the component in the requested file.
- **Bulk Add:** You can add multiple: `npx shadcn@latest add button card dialog`.
- **Update:** To update existing components: `npx shadcn@latest add <name> --overwrite`.
