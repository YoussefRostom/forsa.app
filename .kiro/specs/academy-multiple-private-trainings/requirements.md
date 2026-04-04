# Requirements Document

## Introduction

This feature extends the academy signup flow to support multiple private training entries. Currently, the signup form initializes with a single private training block. The infrastructure for multiple entries already exists in the codebase (array state, add/remove/update handlers, and downstream consumption in `signup-academy-profile.tsx`), but the behavior needs to be fully specified and validated to ensure consistency, correctness, and a good user experience across both the signup page and the profile setup page.

Each private training entry captures: coach name, coach bio, specializations, session duration, and price per session. Academies should be able to add as many private training entries as needed, and each entry must behave identically to the original single entry.

## Glossary

- **Signup_Form**: The academy signup screen rendered by `app/signup-academy.tsx`
- **Profile_Setup**: The second step of academy signup rendered by `app/signup-academy-profile.tsx`
- **Training_Entry**: A single private training block containing coach name, coach bio, specializations, session duration, price per session, and availability fields
- **Training_List**: The ordered collection of one or more Training_Entry items managed during signup
- **Add_Button**: The "Add Another Private Training" button rendered below the Training_List
- **Remove_Button**: The trash icon button rendered in the header of a Training_Entry when more than one entry exists

## Requirements

### Requirement 1: Initial State

**User Story:** As an academy owner, I want the signup form to start with one private training entry, so that I can fill in my primary training offering without extra steps.

#### Acceptance Criteria

1. WHEN the Signup_Form is rendered, THE Training_List SHALL contain exactly one Training_Entry.
2. WHEN the Training_List contains exactly one Training_Entry, THE Signup_Form SHALL NOT display a Remove_Button for that entry.
3. WHEN the Training_List contains exactly one Training_Entry, THE Signup_Form SHALL display the Training_Entry fields without a numbered header label.

### Requirement 2: Adding Training Entries

**User Story:** As an academy owner, I want to add multiple private training entries, so that I can offer sessions with different coaches or formats.

#### Acceptance Criteria

1. WHEN the Add_Button is pressed, THE Training_List SHALL append a new Training_Entry with empty coach name, empty coach bio, empty specializations, session duration defaulting to "60", empty price, and empty availability.
2. WHEN the Training_List contains more than one Training_Entry, THE Signup_Form SHALL display each Training_Entry with a numbered header label (e.g., "Training #1", "Training #2").
3. WHEN the Training_List contains more than one Training_Entry, THE Signup_Form SHALL display a Remove_Button in the header of each Training_Entry.
4. THE Signup_Form SHALL display the Add_Button below all Training_Entry blocks at all times.

### Requirement 3: Removing Training Entries

**User Story:** As an academy owner, I want to remove a private training entry I no longer need, so that I can keep only the relevant offerings.

#### Acceptance Criteria

1. WHEN the Remove_Button for a Training_Entry at index N is pressed, THE Training_List SHALL remove that Training_Entry and preserve all other entries in their original order.
2. WHEN the Training_List is reduced to exactly one Training_Entry, THE Signup_Form SHALL hide the Remove_Button for the remaining entry.
3. WHEN the Training_List is reduced to exactly one Training_Entry, THE Signup_Form SHALL hide the numbered header label for the remaining entry.
4. IF the Remove_Button is pressed and the Training_List contains only one Training_Entry, THEN THE Signup_Form SHALL NOT remove that entry.

### Requirement 4: Editing Training Entry Fields

**User Story:** As an academy owner, I want to edit each training entry's fields independently, so that each coach's details are captured accurately.

#### Acceptance Criteria

1. WHEN a field in Training_Entry at index N is edited, THE Training_List SHALL update only the corresponding field of the entry at index N and leave all other entries unchanged.
2. THE Signup_Form SHALL accept free text input for coach name, coach bio, specializations, and availability fields.
3. THE Signup_Form SHALL accept only numeric input for the session duration field, with a maximum length of 3 characters.
4. THE Signup_Form SHALL accept only numeric input for the price per session field, with a maximum length of 6 characters.
5. WHEN the session duration field of a new Training_Entry is rendered, THE Signup_Form SHALL pre-populate it with the value "60".

### Requirement 5: Validation on Submit

**User Story:** As an academy owner, I want the form to validate my training entries before proceeding, so that I don't accidentally submit incomplete data.

#### Acceptance Criteria

1. WHEN the signup submit button is pressed and at least one Training_Entry has an empty coach name, THE Signup_Form SHALL display an error message and SHALL NOT navigate to the Profile_Setup screen.
2. WHEN the signup submit button is pressed and at least one Training_Entry has an empty price per session, THE Signup_Form SHALL display an error message and SHALL NOT navigate to the Profile_Setup screen.
3. WHEN the signup submit button is pressed and all required fields across all Training_Entry items are filled, THE Signup_Form SHALL serialize the Training_List as a JSON string and pass it to the Profile_Setup screen via route params.

### Requirement 6: Data Propagation to Profile Setup

**User Story:** As an academy owner, I want my training entries to carry over to the profile setup step, so that I don't have to re-enter them.

#### Acceptance Criteria

1. WHEN the Profile_Setup screen is rendered with a valid `privateTrainings` route param, THE Profile_Setup SHALL parse the JSON string and initialize the Training_List with all entries from the Signup_Form.
2. WHEN the Profile_Setup screen is rendered with a valid `privateTrainings` route param containing N entries, THE Profile_Setup SHALL display exactly N Training_Entry blocks.
3. THE Profile_Setup SHALL allow the academy owner to add, remove, and edit Training_Entry items using the same behavior defined in Requirements 2, 3, and 4.
4. WHEN the Profile_Setup form is submitted and a Training_Entry has a non-empty coach name and non-empty price per session, THE Profile_Setup SHALL create a private training program record for that entry.
5. WHEN the Profile_Setup form is submitted and a Training_Entry has an empty coach name or empty price per session, THE Profile_Setup SHALL skip that entry without creating a program record and without displaying an error.

### Requirement 7: Training List Integrity

**User Story:** As an academy owner, I want the training list to remain consistent as I add and remove entries, so that the data I submit is exactly what I entered.

#### Acceptance Criteria

1. WHEN Training_Entry items are added and then removed in any order, THE Training_List SHALL contain only the entries that have not been removed.
2. WHEN a Training_Entry is removed from the middle of the Training_List, THE Training_List SHALL re-index the remaining entries so that numbered headers remain sequential starting from 1.
3. FOR ALL sequences of add and remove operations, THE Training_List SHALL never contain fewer than one Training_Entry.
