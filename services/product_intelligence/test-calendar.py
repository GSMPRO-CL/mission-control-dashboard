from calendar_agent import get_upcoming_commercial_calendar_events

events = get_upcoming_commercial_calendar_events([])
print("Eventos encontrados:")
for event in events:
    print(event)
