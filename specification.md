# Let Them Cook - Application Specification

## Overview
A recipe management application for collecting, consolidating, using, updating, and sharing recipes. Designed for personal use with potential for future public availability.

---

## 1. Recipe Management

### Adding Recipes
- Support multiple input sources: food blog webpages, email text, PDF/docx files, photos of index cards, etc.
- Automated extraction/parsing where possible
- Preserve original source (link/name) if applicable
- Automatically save to personal recipe collection

### Editing & Notes
- Author notes: separate from ingredients/steps (e.g., "use two 9x9 pans when doubling")
- Personal notes: temporary thoughts/variations to try without editing the recipe itself
- Both types editable during cooking/planning

### Versioning
- Every recipe edit creates a new version
- Users can view and restore old versions
- Meal history preserves the version used at that time

### Organization
- Archive recipes to hide from search (still visible in meal history, can be unarchived)

---

## 2. Recipe Data Model

### Ingredients
- **Standardization**: Ingredient names adapt to user localization (e.g., British "coriander" → US "cilantro")
- **Substitutions**:
  - Convert ingredients to common substitutes (e.g., fresh thyme → dried thyme)
  - Available when viewing, editing, planning, or cooking
  - User-selectable when multiple substitutes exist
  - User-contributed substitution data (e.g., egg substitutes for vegan options)
- **Optional ingredients**: Mark ingredients as optional (e.g., mushrooms in stir fry)

### Steps
- **Step-level timing**: Specify time required for each step
- **Active vs. inactive time**: Distinguish active work (chopping, stirring) from passive time (baking, simmering)
- **Percent-based ingredient references**: Steps can reference ingredients by percentage (e.g., "add half the oil"), automatically calculated based on scaled serving size

### Media
- **Images**: Support for finished product photo and per-step images
- **Video**: Record new or include existing videos (especially from food blogs)
- **Visibility control**: Toggle media on/off to avoid screen clutter when not needed

### Metadata
- **Servings**: Display and scale to arbitrary serving sizes (affects ingredient amounts)
- **Time**: Total time (start to finish) and active time
- **Categories**: Multiple categories per recipe (e.g., "dinner entrée", "appetizer", "spicy side dish")
- **Labels**:
  - Dietary restrictions (e.g., gluten-free, vegan)
  - Allergens
  - Auto-generated based on ingredients, manually editable
  - Easy-substitution suggestions (e.g., "can be made gluten-free with 1:1 flour swap")
  - Make-ahead capability and refrigeration/freezing requirements
  - Equipment (e.g., slow cooker)
  - All labeling/categorization is optional

---

## 3. Search & Discovery

### Search
- Search by text in recipe title

### Filtering
- Filter for recipes containing specific ingredients (one or more)
- Filter out recipes containing specific ingredients
- Filter by labels/categories

---

## 4. Meal Planning

### Recipe Selection
- Specify dietary restrictions/preferences to filter available recipes
- Multi-select recipes (shopping cart-style interface)
- **Future enhancement**: Suggest complementary recipes based on selections (e.g., if salad is selected as entrée, prioritize non-salad sides)

### Grocery List
- Consolidated list from all selected recipes
- Editable (remove items already on hand)
- Easy to copy/paste into other apps

### Meal History
- View history of planned meals
- Remake previous meals (regenerate grocery list, enter cook mode with same recipes)

### Cooking Timeline (Long-term Goal)
- Automatically generate cooking schedule: start times, order of operations
- Support concurrent cooking (e.g., start recipe B after putting recipe A in oven)
- Identify make-ahead components (e.g., dessert made the night before)
- Note: Design/architect with this in mind from the start

---

## 5. Cook Mode

### Interface
- Screen wake lock (prevent phone from going dark)
- Easy switching between recipes in planned meal
- Hide unnecessary UI elements
- Step navigation via tap or swipe

### Multi-Recipe Support
- Cook mode for individual recipes or full planned meals

---

## 6. Sharing & Export

### Sharing
- Multiple formats: raw text via email, PDF via email, shareable link

### Export
- Export all recipes in standardized format (e.g., schema.org Recipe)
- If standardized format loses custom data, also support proprietary format export

### Publishing (Stretch Goal)
- Publish recipes for other users to view, discover, and save

---

## 7. Technical Requirements

### Platform Support
- **Primary**: Mobile phone (adding, viewing, cooking, sharing)
- **Secondary**: Web/desktop (adding, sharing, editing)

### Offline Capability
- Full functionality without internet except discovering other users' recipes
- Critical for kitchen use with poor signal

### Data Storage
- **Initial**: Raspberry Pi SD card
- **Requirement**: Abstract data API for easy migration to cloud providers (AWS, GCP, etc.) in future

### Hosting
- Self-hosted on Raspberry Pi
- Designed to run continuously
- Must operate within Pi hardware constraints

---

## 8. Scope & Future Enhancements

### Initial Version (v1)
- Single-user application
- Offline-capable
- Self-hosted on Raspberry Pi
- All core features listed above except those marked as "future" or "long-term"

### Stretch Goals
- Multi-user platform with recipe sharing
- User accounts, permissions, privacy controls
- Copyright and moderation considerations
- Complementary recipe suggestions
- Automated cooking timeline generation

### Design Principles
- Architecture should anticipate multi-user extension
- Keep stretch goals in mind during design/implementation
- Defer complex problems (privacy, accounts, copyright) to later phases
- Focus on single-user experience first
