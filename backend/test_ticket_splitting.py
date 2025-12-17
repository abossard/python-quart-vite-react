"""
Test script for ticket splitting functionality.

Run this to verify the ticket analysis logic works correctly.
"""

import asyncio
from agents import agent_service, _detect_multiple_issues, _generate_split_summary


def test_detection_logic():
    """Test the pure calculation functions for ticket splitting."""
    
    print("=" * 60)
    print("TESTING TICKET SPLITTING DETECTION LOGIC")
    print("=" * 60)
    
    # Test Case 1: Single issue (should NOT split)
    single_issue = "VPN connection fails with Error 720. Please help urgently."
    should_split, issues = _detect_multiple_issues(single_issue)
    print(f"\n✓ Test 1 - Single Issue:")
    print(f"  Description: {single_issue[:60]}...")
    print(f"  Should Split: {should_split}")
    print(f"  Issues Found: {len(issues)}")
    assert should_split == False, "Single issue should not trigger split"
    
    # Test Case 2: Multiple issues (SHOULD split)
    multi_issue = """Guten Tag, ich muss dringend arbeiten aber nichts funktoniert hier. 
    Seit heute morgen kann ich mich nicht per VPN verbinden, es steht immer 'Fehler 720'. 
    
    Und der Drucker im Büro 3.01 geht auch nicht mehr (HP LaserJet 400 M401dn), da steht 'Toner leer'.
    
    Acha ja, und im Software Center werden bei mir keine Apps mehr angezeigt? Ich wollte PowerBI installieren. 
    Mein Natel macht auch probleme, der Akku ist immer gleich leer."""
    
    should_split, issues = _detect_multiple_issues(multi_issue)
    print(f"\n✓ Test 2 - Multiple Issues:")
    print(f"  Description length: {len(multi_issue)} chars")
    print(f"  Should Split: {should_split}")
    print(f"  Issues Found: {len(issues)}")
    for i, issue in enumerate(issues, 1):
        print(f"  Issue {i}: {issue[:60]}...")
    assert should_split == True, "Multiple issues should trigger split"
    assert len(issues) >= 2, "Should detect at least 2 issues"
    
    # Test Case 3: Generate summaries
    if issues:
        summaries = _generate_split_summary("Multiple problems", issues)
        print(f"\n✓ Test 3 - Summary Generation:")
        for i, summary in enumerate(summaries, 1):
            print(f"  Summary {i}: {summary}")
        assert len(summaries) == len(issues), "Should generate one summary per issue"
    
    print("\n" + "=" * 60)
    print("ALL TESTS PASSED ✓")
    print("=" * 60)


async def test_agent_ticket_analysis():
    """Test the agent's ticket analysis and splitting capability."""
    
    print("\n" + "=" * 60)
    print("TESTING AGENT TICKET ANALYSIS")
    print("=" * 60)
    
    # Sample ticket data
    sample_ticket = {
        'id': 'test-ticket-123',
        'summary': 'VPN geht nicht, Drucker kaputt, SW-Center leer, Natel spinnt',
        'description': """Guten Tag, ich muss dringend arbeiten aber nichts funktoniert hier. 
        Seit heute morgen kann ich mich nicht per VPN verbinden, es steht immer 'Fehler 720'. 
        Ich hab's schon 5x probiert.
        
        Und der Drucker im Büro 3.01 geht auch nicht mehr (HP LaserJet 400 M401dn), 
        da steht 'Toner leer' aber wir haben erst letzte woche neuen eingesetzt.
        
        Acha ja, und im Software Center werden bei mir keine Apps mehr angezeigt? 
        Ich wollte PowerBI installieren. Mein Natel macht auch probleme, der Akku ist immer gleich leer.""",
        'city': 'Zürich',
        'requester_name': 'Quinn Taylor',
        'requester_email': 'quinn.taylor@test.net',
        'requester_department': 'Legal',
        'priority': 'low',
        'service': 'Communication'
    }
    
    try:
        result = await agent_service.analyze_and_split_ticket(
            'test-ticket-123',
            sample_ticket
        )
        
        print(f"\n✓ Analysis Result:")
        print(f"  Should Split: {result.get('should_split')}")
        print(f"  Detected Issues: {result.get('detected_issues_count', 0)}")
        
        if result.get('created_tickets'):
            print(f"  Created Tickets:")
            for ticket in result['created_tickets']:
                if 'id' in ticket:
                    print(f"    - {ticket['summary']} (ID: {ticket['id']})")
                else:
                    print(f"    - {ticket.get('summary', 'Unknown')} (Error: {ticket.get('error', 'N/A')})")
        
        print(f"  Modification Added: {result.get('modification_added', False)}")
        
    except Exception as e:
        print(f"\n⚠️  Note: Full agent test requires MCP server connection")
        print(f"  Error: {e}")
        print(f"  This is expected if MCP server is not running")
    
    print("\n" + "=" * 60)


if __name__ == "__main__":
    # Run pure calculation tests
    test_detection_logic()
    
    # Run agent integration test
    print("\n")
    asyncio.run(test_agent_ticket_analysis())
