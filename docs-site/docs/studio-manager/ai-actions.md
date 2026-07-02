---
title: AI Action Mode
sidebar_label: AI Action Mode
---

# AI Action Mode

This guide explains how to use Action Mode to create a scheduled class by typing a plain-language request to the AI assistant, instead of filling in the calendar form yourself.

## Before you start

Action Mode is only available to the studio manager account — instructors do not see it. You need at least one active class template and one active location already set up, since the assistant needs something to schedule the class against.

## What Action Mode does

With Action Mode off, the AI assistant only answers questions — see [AI Support Assistant](./ai-support). With Action Mode on, it can also create a scheduled class for you when you describe it in plain language, for example:

- "Crea una classe di Yoga Flow mercoledì prossimo alle 18:00 a Milano con Elena, un'ora"
- "Schedule a Pilates class next Friday at 9am at the Downtown location, 45 minutes"

The assistant reads your request, matches the class type, location, and instructor you named against what's already set up in your studio, and creates the class immediately once every detail is clear.

## What Action Mode does NOT do

- It never guesses a location, instructor, or class type it isn't sure about. If your request is ambiguous (for example, two instructors with similar names) or missing a detail, it asks a follow-up question instead of creating anything.
- It currently only creates scheduled classes. Cancelling classes, editing clients, or any other action must still be done from the regular screens.
- It never invents a date. If it cannot work out which day you mean, it asks you to clarify.

## How to use it

1. Open the AI assistant by clicking the round chat button (💬) in the bottom-right corner.
   [SCREENSHOT: The floating chat button in the bottom-right corner of the Agon desktop app]

2. In the chat panel header, turn on the **Action mode** switch.
   [SCREENSHOT: The Action mode toggle in the chat panel header]

3. Type your request in plain language, including the class type, location, instructor, day, time, and duration. The more detail you give, the fewer follow-up questions you'll get.
   [SCREENSHOT: An example Action Mode request typed into the chat input]

4. Press **Send** or **Enter**.

5. If anything is missing or ambiguous, the assistant asks a follow-up question. Answer it in the same chat and press Send again.

6. Once the class is created, the assistant confirms it with a green "Action completed" message summarizing what was scheduled.
   [SCREENSHOT: The green confirmation banner after a class is successfully created]

7. The new scheduled class appears immediately on the [Calendar](./classes) screen, exactly as if you had created it through the form — you can edit or cancel it from there like any other class.

## Frequently asked questions

**Does it ask me to confirm before creating the class?**
No — once every detail (class type, location, date, time, duration) is unambiguous, the class is created right away and shown in the confirmation message. If any detail is unclear, it asks first rather than guessing.

**What if I made a mistake in what I typed?**
The class is created just like any other scheduled class. Open the [Calendar](./classes) screen, find it, and edit or cancel it the normal way.

**Can it create recurring classes?**
Not yet — Action Mode currently creates a single scheduled class per request. Use the regular recurring-class form on the Calendar screen for repeating schedules.

## What if something goes wrong?

**The Action mode switch doesn't appear**
Action Mode is only visible when you're logged in as the studio manager. If you're logged in as an instructor, it will not be shown.

**The assistant keeps asking which class type / location / instructor I mean**
This usually means the name you typed matches more than one item, or none at all. Check the exact spelling against what's set up in [Class Types](./classes), and try again.

**The assistant says it created the class, but I don't see it on the calendar**
Refresh the Calendar screen. If it's still missing, check that you're viewing the correct location and week.

## Related pages

- [AI Support Assistant](./ai-support)
- [Classes](./classes)
- [Settings](./settings)
