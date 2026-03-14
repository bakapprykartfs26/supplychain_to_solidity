describe('FSM Flow', () => {
  it('creates a new FSM, saves it, and compiles to Solidity', () => {
    // Start on list page
    cy.visit('/');
    cy.contains('FSM Contracts').should('be.visible');

    // Navigate to new FSM editor
    cy.contains('+ New FSM').click();
    cy.url().should('include', '/editor/new');

    // Set a contract name
    cy.get('input.name-input').clear().type('TrafficLight');

    // Save the FSM
    cy.contains('button', 'Save').click();

    // After save, URL should change to /editor/<id>
    cy.url().should('match', /\/editor\/[0-9a-f-]{36}$/);
    cy.contains('Saved').should('be.visible');

    // Solidity preview panel should be visible
    cy.contains('Solidity Preview').should('be.visible');

    // The preview should contain basic Solidity structure
    cy.get('pre.source-code').should('contain', 'pragma solidity');
    cy.get('pre.source-code').should('contain', 'contract TrafficLight');

    // Navigate back to list — FSM should appear
    cy.contains('← Back').click();
    cy.url().should('eq', Cypress.config().baseUrl + '/');
    cy.contains('TrafficLight').should('be.visible');

    // Delete the FSM (cleanup)
    cy.contains('TrafficLight').parents('li').contains('Delete').click();
    cy.contains('TrafficLight').should('not.exist');
  });
});
