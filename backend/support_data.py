"""
Sample Data Generator for IT Support Dashboard

Generates realistic support ticket data for demonstration purposes.
Creates 550+ tickets spanning 90 days with authentic patterns and issues.
"""

import random
from datetime import datetime, timedelta
from typing import Optional
from support_tickets import (
    SupportTicket, TicketCategory, Priority, TicketStatus,
    SupportTicketService, _tickets_db
)


class SupportDataGenerator:
    """Generates realistic IT support ticket data."""

    def __init__(self):
        self.ticket_counter = 1000
        self.technicians = [
            "Kusi",
            "Noah",
            "Raphael",
            "Luis",
            "Mike",
            "Sandro"
        ]
        
        # Technician specialties
        self.technician_specialties = {
            "Kusi": [TicketCategory.NETWORK, TicketCategory.SECURITY],
            "Noah": [TicketCategory.SOFTWARE, TicketCategory.HARDWARE],
            "Raphael": [TicketCategory.EMAIL, TicketCategory.ACCOUNT_ACCESS],
            "Luis": [TicketCategory.HARDWARE, TicketCategory.PRINTER],
            "Mike": [TicketCategory.SOFTWARE, TicketCategory.OTHER],
            "Sandro": [TicketCategory.SECURITY, TicketCategory.NETWORK]
        }

        # Issue templates by category
        self.issue_templates = {
            TicketCategory.HARDWARE: [
                ("Laptop won't power on after Windows update", "Device won't boot. Power LED shows but screen stays black. Last worked yesterday before automatic Windows update."),
                ("Monitor flickering and showing artifacts", "External monitor showing random colored lines and flickering. Tried different cables with no improvement."),
                ("Keyboard keys not responding (F1-F12)", "Function keys stopped working on laptop keyboard. Regular keys work fine. No liquid damage."),
                ("Mouse cursor jumping randomly across screen", "USB mouse cursor moves erratically. Problem persists with different mouse. May be driver issue."),
                ("Docking station not detecting external displays", "Laptop docked but external monitors not recognized. Displays work when connected directly to laptop."),
                ("Hard drive making clicking sounds", "Unusual clicking noise from laptop. System slower than normal. Concerned about data loss."),
                ("Laptop overheating and shutting down randomly", "Computer gets very hot during normal use and shuts down unexpectedly. Fan seems loud."),
                ("USB ports not working on desktop", "Front USB ports not recognizing any devices. Back ports work normally."),
                ("Laptop battery not charging", "Battery stuck at 0% and won't charge. Laptop only works when plugged in."),
                ("Webcam not detected in Teams meetings", "Built-in webcam not showing up in Microsoft Teams. Works in Camera app."),
            ],
            TicketCategory.SOFTWARE: [
                ("Microsoft Office crashes when opening large Excel files", "Excel freezes and crashes with files over 50MB. Error message mentions memory issue."),
                ("Unable to install Adobe Creative Cloud", "Installation fails at 87% with error code 82. Tried uninstalling and reinstalling."),
                ("Antivirus blocking legitimate business application", "McAfee flagging our custom CRM software as threat. Need exception added."),
                ("Windows update stuck at 67%", "Update has been running for 3 hours. Screen says 'Working on updates' but no progress."),
                ("VPN client disconnects every 10 minutes", "Cisco AnyConnect drops connection frequently. Have to reconnect multiple times per day."),
                ("Outlook not syncing calendar events", "Calendar events not appearing in Outlook. Can see them in web version. Last sync was 2 days ago."),
                ("Software license expired - need renewal", "AutoCAD license expired yesterday. Unable to open any project files."),
                ("Application won't launch after Windows update", "Quickbooks won't start after recent update. Double-clicking does nothing."),
                ("OneDrive sync errors for shared folder", "Getting 'sync pending' errors for Marketing folder. Files not updating across team."),
                ("Teams audio echo during calls", "Participants report hearing echo when I speak. Problem started after recent Teams update."),
            ],
            TicketCategory.NETWORK: [
                ("Cannot connect to WiFi in conference room B", "WiFi network visible but won't connect. Password accepted but connection fails. Works in other rooms."),
                ("Intermittent internet connection drops", "Connection drops 5-6 times per day. Have to disconnect and reconnect WiFi."),
                ("VPN connection extremely slow (< 1 Mbps)", "VPN connected but unusable. Speed test shows less than 1 Mbps. Normal connection is 100+ Mbps."),
                ("Cannot access shared network drive", "Getting 'Network path not found' error when accessing \\\\fileserver\\shared. Worked yesterday."),
                ("Getting 'DNS server not responding' error", "Internet works intermittently. Error message says DNS server isn't responding. Tried flushing DNS."),
                ("Ethernet port not working at desk 42", "Wired connection not working at new desk. WiFi works but need wired for stability."),
                ("Remote desktop connection timing out", "Cannot RDP to workstation. Connection attempt times out after 30 seconds. Used to work remotely."),
                ("Slow file transfer speeds on network", "Copying files to server takes forever. 1GB file takes 20+ minutes. Should be faster."),
                ("Cannot ping internal servers", "Unable to ping any internal IP addresses. Internet works but local network inaccessible."),
                ("WiFi keeps asking for credentials", "Have to re-enter WiFi password multiple times per day. Credentials should be saved."),
            ],
            TicketCategory.EMAIL: [
                ("Emails stuck in Outbox, won't send", "5 emails stuck in Outbox since this morning. Receiving emails fine but can't send."),
                ("Not receiving emails from external domain", "Haven't received any emails from @client.com in 2 days. They confirm messages were sent."),
                ("Mailbox full - need storage quota increase", "Getting 'mailbox full' error. Can't receive new emails. Need more storage space."),
                ("Spam filter blocking important client emails", "Client's invoices going to spam folder. Need to whitelist their domain."),
                ("Cannot add shared mailbox in Outlook", "Trying to add support@company.com shared mailbox. Getting access denied error."),
                ("Email signature not appearing on mobile", "Signature shows on desktop Outlook but not on iPhone mail app."),
                ("Distribution list not working properly", "Emails to sales@company.com not reaching all team members. Missing 3 people."),
                ("Receiving duplicate emails", "Getting every email twice. Started happening yesterday afternoon."),
                ("Auto-reply not working while on vacation", "Set out-of-office message but colleagues say they're not receiving it."),
                ("Cannot recall sent email", "Sent email to wrong recipient. Need to recall message urgently."),
            ],
            TicketCategory.SECURITY: [
                ("Account locked after multiple failed login attempts", "Locked out of account after entering wrong password. Need unlock to access system."),
                ("Suspicious email received - possible phishing", "Received email claiming to be from CEO requesting wire transfer. Looks suspicious. Forwarding for review."),
                ("Need two-factor authentication reset", "Lost phone with authenticator app. Cannot access any company systems."),
                ("Security certificate expired for internal site", "Getting security warning when accessing intranet. Certificate expired 3 days ago."),
                ("Ransomware alert - need immediate assistance", "Antivirus detected ransomware attempt. Several files showing .encrypted extension. Computer quarantined."),
                ("Lost company laptop with sensitive data", "Left laptop in taxi yesterday evening. Contains client data. Need immediate action."),
                ("Unauthorized access attempt detected", "Received email about login attempt from Russia. I'm currently in Chicago. Changing password now."),
                ("BitLocker recovery key needed", "Laptop asking for BitLocker recovery key after update. Cannot access Windows."),
                ("Suspicious activity on my account", "Emails sent from my account that I didn't send. Last night at 2 AM. Think account compromised."),
                ("VPN access from unknown location", "Security alert shows VPN login from Germany. I haven't traveled. Possible breach."),
            ],
            TicketCategory.ACCOUNT_ACCESS: [
                ("Forgot Active Directory password", "Cannot remember password. Account will lock after one more failed attempt. Need reset."),
                ("Need access to Finance shared folder", "Starting new role in finance department. Require read/write access to Finance folder."),
                ("New employee - need account setup", "New hire starting Monday. Need email, network login, and access to department resources."),
                ("Cannot login to Salesforce CRM", "Getting 'invalid username or password' error. Password works for everything else."),
                ("Account disabled - returning from leave", "Returned from 3-month leave. Account shows as disabled. Need reactivation."),
                ("Need permission for expense reporting system", "Cannot access Concur expense system. Getting access denied error."),
                ("Multi-factor authentication device lost", "Lost security token for MFA. Cannot login without it. Need new token."),
                ("Password reset not working", "Self-service password reset sends code to old phone number. Number disconnected."),
                ("Need admin rights for software installation", "Require admin privileges temporarily to install development tools."),
                ("Cannot access customer database", "New project requires access to customer CRM. Current permissions insufficient."),
            ],
            TicketCategory.PRINTER: [
                ("Printer showing 'paper jam' but no paper stuck", "Error says paper jam but nothing visible. Checked all compartments. Printer won't clear error."),
                ("Print jobs queued but nothing printing", "Documents show in queue but printer not responding. Tried restarting printer."),
                ("Printer offline despite being powered on", "Printer shows offline in Windows. Device is powered on and connected to network."),
                ("Color prints coming out faded", "Color quality very poor. Prints look washed out. Black and white prints fine."),
                ("Cannot find printer on network", "Newly assigned desk. Cannot find floor 3 printer in printer list."),
                ("Scanner not working on MFP device", "Scan to email not working. Print and copy functions work normally."),
                ("Need toner replacement for printer in Room 305", "Printer showing 'toner low' warning. Prints are coming out light."),
                ("Printer printing blank pages", "Print job completes but pages come out blank. Toner level shows 60%."),
                ("Duplex printing not working", "Double-sided printing option not working. All prints single-sided."),
                ("Printer extremely slow", "Print jobs taking 5+ minutes for single page. Used to be instant."),
            ],
            TicketCategory.OTHER: [
                ("Desk phone not receiving incoming calls", "Can make outbound calls but incoming calls go straight to voicemail. Phone rings 0 times."),
                ("Conference room projector has purple tint", "Projector display very purple/magenta. Adjusted settings with no improvement."),
                ("Badge reader not working at main entrance", "Security badge not working on main door. Works on other floors."),
                ("Zoom meeting audio echo issues", "Participants in my Zoom calls hear echo. Problem doesn't occur in Teams."),
                ("Ergonomic assessment requested", "Experiencing wrist pain. Need ergonomic keyboard and mouse evaluation."),
                ("Software procurement request", "Need to purchase Tableau license for data visualization project. Budget approved."),
                ("IT equipment for new hire", "New developer starting next week. Need laptop, monitor, keyboard, mouse setup."),
                ("Monitor stand adjustment needed", "Monitor arm won't stay in position. Keeps drooping down. Desk 127."),
                ("Headset microphone not working", "USB headset audio works but microphone not picking up sound. Tried different USB port."),
                ("Request new mobile device", "Current iPhone 8 very slow. Need upgrade for work efficiency."),
            ]
        }

    def generate_realistic_issue(self, category: TicketCategory) -> tuple[str, str]:
        """Generate realistic title and description for category."""
        templates = self.issue_templates.get(category, [])
        if templates:
            return random.choice(templates)
        return (f"General {category.value} issue", "Issue requires attention from IT support.")

    def calculate_resolution_time(self, priority: Priority, status: TicketStatus) -> Optional[float]:
        """Calculate realistic resolution time based on priority."""
        if status not in [TicketStatus.RESOLVED, TicketStatus.CLOSED]:
            return None

        # Resolution time targets with variation
        base_hours = {
            Priority.CRITICAL: random.uniform(1, 4),
            Priority.HIGH: random.uniform(6, 16),
            Priority.MEDIUM: random.uniform(20, 48),
            Priority.LOW: random.uniform(40, 96)
        }
        
        return round(base_hours.get(priority, 24), 2)

    def assign_technician(self, category: TicketCategory) -> Optional[str]:
        """Assign technician based on specialty and workload."""
        # Find technicians who specialize in this category
        specialists = [
            tech for tech, specialties in self.technician_specialties.items()
            if category in specialties
        ]
        
        # 80% assigned, 20% unassigned (newly created)
        if random.random() < 0.2:
            return None
            
        # Prefer specialists, but sometimes assign others
        if specialists and random.random() < 0.8:
            return random.choice(specialists)
        
        return random.choice(self.technicians)

    def generate_customer_satisfaction(self, resolution_hours: Optional[float], priority: Priority) -> Optional[int]:
        """Generate customer satisfaction rating based on resolution time."""
        if resolution_hours is None:
            return None
        
        # Only rate 80% of resolved tickets
        if random.random() < 0.2:
            return None
        
        # SLA targets
        sla_targets = {
            Priority.CRITICAL: 4,
            Priority.HIGH: 16,
            Priority.MEDIUM: 48,
            Priority.LOW: 96
        }
        
        sla = sla_targets.get(priority, 48)
        
        # Rating based on SLA performance
        if resolution_hours <= sla * 0.5:  # Exceptional
            return random.choices([4, 5], weights=[30, 70])[0]
        elif resolution_hours <= sla:  # On time
            return random.choices([3, 4, 5], weights=[15, 35, 50])[0]
        elif resolution_hours <= sla * 1.5:  # Slightly late
            return random.choices([2, 3, 4], weights=[20, 50, 30])[0]
        else:  # Very late
            return random.choices([1, 2, 3], weights=[30, 50, 20])[0]

    def get_day_multiplier(self, date: datetime) -> float:
        """Get ticket volume multiplier based on day of week."""
        weekday = date.weekday()
        multipliers = {
            0: 1.5,   # Monday - highest volume
            1: 1.0,   # Tuesday
            2: 1.0,   # Wednesday
            3: 1.0,   # Thursday
            4: 0.8,   # Friday - lower volume
            5: 0.2,   # Saturday - very low
            6: 0.2    # Sunday - very low
        }
        return multipliers.get(weekday, 1.0)

    def generate_sample_tickets(self, count: int = 550, days: int = 90) -> list[SupportTicket]:
        """Generate realistic ticket data spanning specified days."""
        tickets = []
        now = datetime.now()
        start_date = now - timedelta(days=days)
        
        # Category distribution (realistic weights)
        category_weights = {
            TicketCategory.EMAIL: 20,
            TicketCategory.SOFTWARE: 18,
            TicketCategory.ACCOUNT_ACCESS: 16,
            TicketCategory.HARDWARE: 14,
            TicketCategory.NETWORK: 12,
            TicketCategory.PRINTER: 10,
            TicketCategory.SECURITY: 6,
            TicketCategory.OTHER: 4
        }
        
        # Priority distribution
        priority_weights = {
            Priority.CRITICAL: 5,
            Priority.HIGH: 15,
            Priority.MEDIUM: 50,
            Priority.LOW: 30
        }
        
        # Status distribution
        status_weights = {
            TicketStatus.CLOSED: 60,
            TicketStatus.RESOLVED: 10,
            TicketStatus.IN_PROGRESS: 18,
            TicketStatus.OPEN: 8,
            TicketStatus.WAITING_ON_CUSTOMER: 4
        }
        
        for i in range(count):
            # Generate creation date with day-of-week patterns
            random_day = random.uniform(0, days)
            created_at = start_date + timedelta(days=random_day)
            day_multiplier = self.get_day_multiplier(created_at)
            
            # Skip some tickets for weekend days to maintain realistic distribution
            if day_multiplier < 1.0 and random.random() > day_multiplier:
                continue
            
            # Add time of day (peak hours: 9-11 AM, 2-4 PM)
            hour = random.choices(
                range(24),
                weights=[1,1,1,1,1,1,2,5,10,15,15,10,5,3,8,12,12,8,4,2,1,1,1,1]
            )[0]
            created_at = created_at.replace(
                hour=hour,
                minute=random.randint(0, 59),
                second=random.randint(0, 59)
            )
            
            # Select category, priority, status
            category = random.choices(
                list(category_weights.keys()),
                weights=list(category_weights.values())
            )[0]
            
            priority = random.choices(
                list(priority_weights.keys()),
                weights=list(priority_weights.values())
            )[0]
            
            status = random.choices(
                list(status_weights.keys()),
                weights=list(status_weights.values())
            )[0]
            
            # Generate issue details
            title, description = self.generate_realistic_issue(category)
            
            # Calculate resolution time and resolved_at
            resolution_time = self.calculate_resolution_time(priority, status)
            resolved_at = None
            if resolution_time is not None:
                resolved_at = created_at + timedelta(hours=resolution_time)
                # Don't resolve tickets in the future
                if resolved_at > now:
                    resolved_at = None
                    resolution_time = None
                    status = random.choice([TicketStatus.OPEN, TicketStatus.IN_PROGRESS])
            
            # Assign technician
            assigned_to = self.assign_technician(category)
            
            # Generate satisfaction rating
            customer_satisfaction = self.generate_customer_satisfaction(resolution_time, priority)
            
            # Create ticket
            self.ticket_counter += 1
            ticket = SupportTicket(
                ticket_number=f"TICK-{self.ticket_counter}",
                title=title,
                description=description,
                category=category,
                priority=priority,
                status=status,
                assigned_to=assigned_to,
                created_at=created_at,
                updated_at=resolved_at or created_at,
                resolved_at=resolved_at,
                resolution_time_hours=resolution_time,
                customer_satisfaction=customer_satisfaction,
                worklogs=[]
            )
            
            tickets.append(ticket)
        
        return tickets

    def simulate_live_ticket_creation(self) -> SupportTicket:
        """Create a new 'live' ticket for SSE stream simulation."""
        category_weights = {
            TicketCategory.EMAIL: 20,
            TicketCategory.SOFTWARE: 18,
            TicketCategory.ACCOUNT_ACCESS: 16,
            TicketCategory.HARDWARE: 14,
            TicketCategory.NETWORK: 12,
            TicketCategory.PRINTER: 10,
            TicketCategory.SECURITY: 6,
            TicketCategory.OTHER: 4
        }
        
        priority_weights = {
            Priority.CRITICAL: 5,
            Priority.HIGH: 15,
            Priority.MEDIUM: 50,
            Priority.LOW: 30
        }
        
        category = random.choices(
            list(category_weights.keys()),
            weights=list(category_weights.values())
        )[0]
        
        priority = random.choices(
            list(priority_weights.keys()),
            weights=list(priority_weights.values())
        )[0]
        
        title, description = self.generate_realistic_issue(category)
        
        self.ticket_counter += 1
        ticket = SupportTicket(
            ticket_number=f"TICK-{self.ticket_counter}",
            title=title,
            description=description,
            category=category,
            priority=priority,
            status=TicketStatus.OPEN,
            assigned_to=None,
            created_at=datetime.now(),
            worklogs=[]
        )
        
        return ticket


def initialize_support_data(count: int = 550) -> int:
    """Initialize database with sample support tickets."""
    _tickets_db.clear()
    
    generator = SupportDataGenerator()
    tickets = generator.generate_sample_tickets(count=count)
    
    # Store tickets in database
    for ticket in tickets:
        _tickets_db[ticket.id] = ticket
    
    return len(tickets)
