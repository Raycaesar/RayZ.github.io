// ===============================================
// =============== AGENT FUNCTIONS ===============
// ===============================================
const agentFollowers = {};
let agentBeliefs = {};
let Agt = [];  // This makes it global


const agentColors = {}; // We use in graph Drawing
let colorCounter = 0;
const colors = ['#D67293', ' #73DEFA', '#5DB117', '#5A8CD7', '#CCCC00', '#9A5FD7', '#FA1CA8', '#A300A3', '#00A3A3']; // An array of colors for agents


// Set Agent Size and Update Dropdowns
function setAgentSize() {
    const size = parseInt(document.getElementById("agentSize").value);
    Agt = Array.from({length: size}, (_, i) => i < 4 ? ['a', 'b', 'c', 'd'][i] : `a_${i + 1}`);

    Agt.forEach((agent, index) => {
        agentColors[agent] = colors[index % colors.length];
    });
    
    updateDropdown("selectedAgent");
    updateDropdown("agentFollowers");
    updateDropdown("beliefAgent");
}


// Helper function to update dropdowns
function updateDropdown(elementId) {
    let dropdown = document.getElementById(elementId);
    dropdown.innerHTML = '';

    for (let agent of Agt) {
        let option = document.createElement('option');
        option.value = agent;
        option.text = agent;
        dropdown.appendChild(option);
    }
}

// Set Agent Followers
function setAgentFollowers() {
    let selectedAgent = document.getElementById("selectedAgent").value;
    let followerOptions = document.getElementById("agentFollowers").options;
    let selectedFollowers = Array.from(followerOptions).filter(opt => opt.selected).map(opt => opt.value);

    // Ensure agentFollowers[selectedAgent] is an array
    agentFollowers[selectedAgent] = agentFollowers[selectedAgent] || [];
    agentFollowers[selectedAgent] = selectedFollowers;
    displayFollowers();
}


// Display Followers
function displayFollowers() {
    let outputfollower = '';
    for (let agent in agentFollowers) {
        outputfollower += `f(${agent}) = {${agentFollowers[agent].join(', ')}}\n`;
    }
    document.getElementById("followerOutput").innerText = outputfollower;
}

// ================================================
// =============== PROP FUNCTIONS =================
// ================================================
let Prop = [];  // This makes it global



// Set Proposition Size
function setPropSize() {
    const size = parseInt(document.getElementById("propSize").value);
    if (size < 4) {
        Prop = ['p', 'q', 'r'].slice(0, size);
    } else if (size === 4) {
        Prop = ['p', 'q', 'r', 's'];
    } else if (size === 5) {
        Prop = ['p', 'q', 'r', 's', 't'];
    } else {
        Prop = ['p', 'q', 'r', 's', 't'].concat(Array.from({length: size - 5}, (_, i) => `p_${i + 2}`));
    }
    document.getElementById("propOutput").innerText = `Prop = {${Prop.join(', ')}}`;
}



// ================================================
// =============== message FUNCTIONS ==============
// ================================================

// Tokenizer
function tokenize(message) {
    return message.match(/~|\+|&|>|[a-z]_[0-9]+|[a-z]|[\(\)]/g);
}

// Recursive parser
function parse(tokens) {
    if (tokens.length === 0) throw new Error("Unexpected end of input");

    let token = tokens.shift();
    
    if (token === '~') {
        return {
            type: 'negation',
            submessage: parse(tokens)
        };
    } else if (token === '(') {
        let left = parse(tokens);
        
        if (tokens.length === 0 || ['&', '+', '>'].indexOf(tokens[0]) === -1) {
            throw new Error("Expected an operator");
        }
        
        let operator = tokens.shift(); 
        
        let right = parse(tokens);
        
        if (tokens[0] !== ')') {
            throw new Error("Expected a closing bracket");
        }
        
        tokens.shift();  
        return {
            type: operator,
            left: left,
            right: right
        };
    } else if (Prop.includes(token)) {  // atom
        return {
            type: 'atom',
            value: token
        };
    } else {
        throw new Error(`Unexpected token: ${token}`);
    }
}

//message Check
function isWellFormedSimpleCheck(message) {
    const binaryOperators = ['&', '+', '>'];

    let operatorCount = 0;
    for (const operator of binaryOperators) {
        operatorCount += (message.match(new RegExp(`\\${operator}`, 'g')) || []).length;
    }

    const bracketPairsCount = (message.match(/\(/g) || []).length;

    return operatorCount === bracketPairsCount;
}



// ===============================================
// ============== Denotation Compute==============
// ===============================================


//We obtain denotation by substiting messages from atomic with sets.

function replaceWithDenotation(parsedmessage) {
    console.log("replaceWithDenotation called with:", parsedmessage);
    if (!parsedmessage) throw new Error("Invalid or non-well-formed message.");

    switch (parsedmessage.type) {
        case 'atom':
            const denotation = atomDenotation(parsedmessage.value);
            if (denotation.length === 0) return '{}';
            return `{{${denotation.map(set => set.join(', ')).join('}, {')}}}`;
            
        case 'negation':
            const innerDenotation = replaceWithDenotation(parsedmessage.submessage);
            if (innerDenotation === '{}') return '{{}}'; // Handle negation of empty set
            if (innerDenotation.startsWith("{{") && innerDenotation.endsWith("}}")) {
                let setString = innerDenotation.slice(2, -2).split('}, {'); 
                let setArray = setString.map(str => str.split(', ').filter(Boolean));
                let complementSet = complementOfSet(setArray);
                if (complementSet.length === 0) return '{}'; // Return {} if the complement set is empty
                return `{{${complementSet.map(set => set.join(', ')).join('}, {')}}}`;
            }
            return `~${innerDenotation}`;

        case '&':
        case '+':
            const leftDenotation = replaceWithDenotation(parsedmessage.left);
            const rightDenotation = replaceWithDenotation(parsedmessage.right);

            if (leftDenotation.startsWith("{{") && leftDenotation.endsWith("}}") &&
                rightDenotation.startsWith("{{") && rightDenotation.endsWith("}}")) {
                
                let setA = leftDenotation.slice(2, -2).split('}, {').map(str => str.split(', ').filter(Boolean));
                let setB = rightDenotation.slice(2, -2).split('}, {').map(str => str.split(', ').filter(Boolean));

                let resultSet;
                if (parsedmessage.type === '&') {
                    resultSet = setIntersection(setA, setB);
                } else { // '+'
                    resultSet = setUnion(setA, setB);
                }
                
                if (resultSet.length === 0) return '{}'; // Return {} if the result set is empty
                return `{{${resultSet.map(set => set.join(', ')).join('}, {')}}}`;
            }

            return `(${leftDenotation} ${parsedmessage.type} ${rightDenotation})`;

        case '>':
            const notLeft = {
                type: 'negation',
                submessage: parsedmessage.left
            };
            const orRight = {
                type: '+',
                left: notLeft,
                right: parsedmessage.right
            };
            return replaceWithDenotation(orRight);

        default:
            throw new Error("Invalid or non-well-formed message.");
    }
}


// Display Denotation
function displayDenotation() {
    try {
        const message = document.getElementById("messageInput").value;

        if (!isWellFormedSimpleCheck(message)) {
            throw new Error("The message is not well-formed!");
        }

        const parsed = parse(tokenize(message));
        let result = replaceWithDenotation(parsed);
        document.getElementById("resultOutput").innerText = result;
    } catch (error) {
        alert(error.message);
    }
}

// ===============================================
// =============== BELIEF FUNCTIONS ==============
// ===============================================

function assignBelief() {
    try {
        
        const message = document.getElementById("beliefmessage").value;

        if (!isWellFormedSimpleCheck(message)) {
            throw new Error("The message is not well-formed!");
        }

        const selectedAgent = document.getElementById("beliefAgent").value;
        const parsed = parse(tokenize(message));
        const denotationResult = replaceWithDenotation(parsed);

        // Check if the agent already has beliefs
        if (agentBeliefs[selectedAgent]) {
            // Append new message to the beliefs
            agentBeliefs[selectedAgent].messages.push(message);
            
            // Intersect the new denotation with the previous one
            let oldDenotation = agentBeliefs[selectedAgent].denotation.slice(2, -2).split('}, {').map(str => str.split(', ').filter(Boolean));
            let newDenotation = denotationResult.slice(2, -2).split('}, {').map(str => str.split(', ').filter(Boolean));
            let intersection = setIntersection(oldDenotation, newDenotation);
            
            if (intersection.length === 0) {
                agentBeliefs[selectedAgent].denotation = '{}'; // Set denotation to empty if there's a contradiction
            } else {
                agentBeliefs[selectedAgent].denotation = `{{${intersection.map(set => set.join(', ')).join('}, {')}}}`;
            }
        } else {
            // If no prior beliefs, initialize with the current one
            agentBeliefs[selectedAgent] = {
                messages: [message],
                denotation: denotationResult
            };
        }

        // Update the displayed beliefs for all agents
        displayAgentBeliefs();
    } catch (error) {
        alert(error.message);
    }
}



function displayAgentBeliefs() {
    let outputText = '';
    for (let agent in agentBeliefs) {
        // Wrap agent's name in a span, color it, and make it bold using inline CSS
        const coloredAgentName = `<span style="color: ${agentColors[agent]}; font-weight: bold;">${agent}</span>`;
        outputText += `${coloredAgentName} believes ${agentBeliefs[agent].messages.join(' and ')} and k(${agent}) = ${agentBeliefs[agent].denotation}<br>`;
    }
    // Using innerHTML instead of innerText since we are adding HTML tags
    document.getElementById("beliefOutput").innerHTML = outputText;
}


/*for verification  


(p+(~q&((r+~p)>~(p>~r)))) ===> {{p}, {q, p}, {r, p}, {r, q, p}}

((p > q) & (q > r)) ===>  {{}, {r}, {r, q}, {r, q, p}}

both ===> {{r, q, p}}
*/


// ================================================
// =============== AUXILIARY FUNCTIONS ============
// ================================================

// Global arraysAreEqual function
function arraysAreEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
        if (arr1[i] !== arr2[i]) return false;
    }
    return true;
}


function setUnion(setA, setB) {
    const union = [...setA];
    for (const subset of setB) {
        if (!union.some(item => arraysAreEqual(item, subset))) {
            union.push(subset);
        }
    }
    return union;
}

function setIntersection(setA, setB) {
    return setA.filter(subsetA => setB.some(subsetB => arraysAreEqual(subsetA, subsetB)));
}

function complementOfSet(set) {
    let powerSetOfProp = powerSet(Prop);
    return powerSetOfProp.filter(subset => !set.some(item => arraysAreEqual(item, subset)));

    function arraysAreEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }
}

function atomDenotation(atom) {
    return powerSet(Prop).filter(subset => subset.includes(atom));
}

function powerSet(array) {
    return array.reduce((subsets, value) => subsets.concat(subsets.map(set => [value, ...set])), [[]]);
}



function isSubsetOf(subset, superset) {
    for (let element of subset) {
        if (!superset.includes(element)) {
            return false;
        }
    }
    return true;
}

function parseDenotationString(denotationString) {
    return denotationString
        .slice(2, -2)  // Remove the outer '{{' and '}}'
        .split('}, {')  // Split by '}, {' to get individual worlds
        .map(worldString => 
            worldString.split(', ').map(atom => atom.slice(1, -1))  // Split by ', ' and remove the surrounding '{' and '}'
        );
}

// Sample usage:
// const denotationString = '{{p}, {q, p}, {r, p}, {r, q, p}}';
// console.log(parseDenotationString(denotationString));
// Expected output: [['p'], ['q', 'p'], ['r', 'p'], ['r', 'q', 'p']]


//evaluate formula

function satisfiability() {
    const formula = document.getElementById("formulaInput").value.trim();
    const subtokens = tokenizeFormula(formula); // Get tokens first
    const parsedFormula = parseFormula(subtokens); // Pass tokens to the parser
    
    const satResult = checkSatisfiability(parsedFormula);

    document.getElementById("satisfaction").innerText = satResult ? "The formula is satisfiable." : "The formula is not satisfiable.";
}


function tokenizeFormula(formula) {
    if (typeof formula !== "string") {
        throw new TypeError("Formula must be a string.");
    }

    // The order matters; we want to capture multi-character tokens before single ones.
    return formula.match(/B[a-z]|~|&|\+|\[.*?\]|[a-z]_[0-9]+|[a-z]|[\(\)]/g);
}


function parseFormula(subtokens) {
    console.log("Parsing formula with subtokens:", subtokens);

    let stack = [];

    for (let [index, token] of subtokens.entries()) {
        if (token.startsWith('B')) {
            let agent = token[1];  // Since the token is like 'Ba', the agent is the second character
            let remainingTokens = subtokens.slice(index + 1); // get the remaining tokens
            let proposition = parseFormula(remainingTokens); // recursively parse the remaining tokens
            stack.push({ type: "belief", agent: agent, proposition: proposition });
        } else {
           
            switch (token) {
                case '~':
                    let negatedElement = getNextToken(subtokens);
                    stack.push({ type: "not", element: negatedElement });
                    break;
                case '&':
                    let leftConjunct = stack.pop();
                    let rightConjunct = getNextToken(subtokens);
                    stack.push({ type: "and", left: leftConjunct, right: rightConjunct });
                    break;
                case '+':
                    let leftDisjunct = stack.pop();
                    let rightDisjunct = getNextToken(subtokens);
                    stack.push({ type: "or", left: leftDisjunct, right: rightDisjunct });
                    break;
                case '[':
                    let announcementAgent = getNextToken(subtokens);
                    let announcementProposition = getNextToken(subtokens);
                    stack.push({ type: "announcement", agent: announcementAgent, proposition: announcementProposition });
                    break;
                default:
                    if (token.match(/^[a-z](_[0-9]+)?$/)) {  // Checks if token is an atomic proposition
                        stack.push({ type: 'atom', value: token });
                    } else {
                        throw new Error(`Unexpected token: ${token} at position ${index} in formula.`);
                    }
                    break;
            }
        }
    }

    return stack[0];
}

function includesArray(bigArray, smallArray) {
    return bigArray.some(arr => JSON.stringify(arr) === JSON.stringify(smallArray));
}





function getNextToken(subtokens) {
    return subtokens.shift();
}

function checkSatisfiability(parsedFormula) {
    switch(parsedFormula.type) {
        case "belief":
            const agent = parsedFormula.agent;
            const proposition = parsedFormula.proposition;

            if (!agentBeliefs[agent]) {
                console.error(`Agent '${agent}' does not have any assigned beliefs.`);
                return false; 
            }
            console.log(`Beliefs for agent ${agent}:`, agentBeliefs[agent]);

            if (typeof agentBeliefs[agent].denotation === 'string') {
                agentBeliefs[agent].denotation = parseDenotationString(agentBeliefs[agent].denotation);
            }

            const agentBeliefWorlds = agentBeliefs[agent] && agentBeliefs[agent].denotation;
            console.log("agentBeliefWorlds:", agentBeliefWorlds);
            const denotation_to_array = replaceWithDenotation(proposition)
            const propositionDenotation = parseDenotationString(denotation_to_array);
            console.log("propositionDenotation:", propositionDenotation);
            
            if (!Array.isArray(agentBeliefWorlds) || !agentBeliefWorlds.every(Array.isArray)) {
                console.error(`AgentBeliefWorlds for agent '${agent}' is not a proper array of arrays.`);
                return false;
            }

            if (!Array.isArray(propositionDenotation) || !propositionDenotation.every(Array.isArray)) {
                console.error("Proposition denotation is not a proper array of arrays:", propositionDenotation);
                return false;
            }

            return agentBeliefWorlds.every(beliefWorld => includesArray(propositionDenotation, beliefWorld));
       
        case "not":
            return !checkSatisfiability(parsedFormula.element);

        case "and":
            return checkSatisfiability(parsedFormula.left) && checkSatisfiability(parsedFormula.right);

        case "or":
            return checkSatisfiability(parsedFormula.left) || checkSatisfiability(parsedFormula.right);

        case "announcement":
            // Assuming public announcement; for now, we'll just return true.
            // More advanced handling for public announcement can be added later.
            return true;

        default:
            console.error(`Unknown formula type: ${parsedFormula.type}`);
            return false;
    }
}








