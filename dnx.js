export {dnx};

class ExecutionStack {
    
    constructor(content) {
        if(Array.isArray(content)){
            this.list=content;
        }else{
            this.list=[content];
        }
    }
    
    getVarNames() {
        let paramNames=[];
        for(let context of this.list) {
            paramNames.push(context.name);
        }
        return paramNames;
    }
    
    getVarValues() {
        let paramValues=[];
        for(let context of this.list) {
            paramValues.push(context.value);
        }
        return paramValues;
    }
    
    add(element) {
        let tmp=[];
        tmp=tmp.concat(this.list);
        tmp.push(element);
        return new ExecutionStack(tmp);
    }
    
}

function dnx(elementParam, contextParam) {
    let element;
    if(typeof elementParam === "string" || typeof elementParam === "String") {
        element=document.getElementById(elementParam);
    }else{
        element=elementParam;
    }
    
    let context={
        name: "context",
        value: null
    };
    
    if(contextParam) {
        Object.assign(context, contextParam);
    }
    
    if(!(contextParam && contextParam.name) && element.getAttribute("dnx-contextName")) {
        context.name=element.getAttribute("dnx-contextName");
    }
    
    if(!(contextParam && contextParam.value) && element.getAttribute("dnx-contextValue")) {
        context.value=Function("return "+element.getAttribute("dnx-contextValue")+";").apply(element, []);
    }
    
    let proxy=wrapProxy(element, context);
    process(element, new ExecutionStack({
        name: context.name,
        value: proxy
    }));
    if(element.getAttribute("dnx-contextValue")) {
        Function("proxy", element.getAttribute("dnx-contextValue")+"=proxy;").apply(element, [proxy]);
    }
    element.dnxRoot=true;
    element.dnxUpdate();
    return proxy;
}

function wrapProxy(element, context) {
    if(context.value === null || (typeof context.value) !== "object") {
        throw "context.value param is not an object. Value: ["+context.value+"] type: ["+type+"].";
    }
    
    return new Proxy(context.value, {
        get: function (target, name) {
            const property = target[name];
            return (typeof property === 'function')
                    ? property.bind(target)
                    : property;
        },
        set(obj, prop, value) {
            console.log("set proxy");
            const result = Reflect.set(...arguments);
            let contextStack=[];
            contextStack.push(context);
            element.dnxUpdate();
            return result;
        }
    });
}

const evaluator={
    doCall: (executionStack, expr) => {
        return Function(executionStack.getVarNames(), expr).apply(null, executionStack.getVarValues());
    },
    doReturnGetterExpr: (executionStack, expr) => {
        return Function(executionStack.getVarNames(), "return "+expr+";").apply(null, executionStack.getVarValues());
    },
    doAssignSetterExpr: (executionStack, expr, value) => {
        let asignExecutionStack=executionStack.add({
            name: "value",
            value: value
        });
        Function(asignExecutionStack.getVarNames(), expr+"=value;").apply(null, asignExecutionStack.getVarValues());
    }
};

function process(element, environment) {
    let updaters=[];
    
    function attributeCopier(e, attributeName, attributeValueExp, environment) {
        e[attributeName]=Function(environment.getVarNames(), "return "+attributeValueExp+";").apply(null, environment.getVarValues());
    }

    const processorsBySelector={
        "template[dnx-items]": function(e, attributeName, attributeValue, environment) {
            let parentNode=e.parentNode;
            updaters.push(() => {
                parentNode.textContent="";
                for(let item of Function(environment.getVarNames(), "return "+attributeValue+";").apply(null, environment.getVarValues())) {
                    let cloneNode=e.content.cloneNode(true);
                    process(cloneNode, environment.add({
                        name: e.getAttribute("dnx-item"),
                        value: item
                    }));
                    parentNode.appendChild(cloneNode);
                    cloneNode.dnxUpdate();
                }
            });
        },
        "[dnx-innerHTML]": function(e, attributeName, attributeValue, environment) {
            updaters.push(() => {
                attributeCopier(e, attributeName, attributeValue, environment);
            });
        },
        "[dnx-attached]": function(e, attributeName, attributeValue, environment) {
            let parent=e.parentNode;
            let next={
                value:null
            };
            updaters.push(() => {
                const value=Function(environment.getVarNames(), "return "+attributeValue+";").apply(null, environment.getVarValues());
                if(value) {
                    if(!e.parentNode) {
                        if(next.value){
                            next.value.before(e);
                        }else{
                            parent.insertBefore(e, null);
                        }
                    }
                }else{
                    if(e.parentNode) {
                        next.value=e.nextSibling;
                        parent.removeChild(e);
                    }
                }
            });
        },
        "[dnx-disabled]": function(e, attributeName, attributeValue, environment) {
            updaters.push(() => {
                attributeCopier(e, attributeName, attributeValue, environment);
            });
        },
        "img[dnx-src]": function(e, attributeName, attributeValue, environment) {
            updaters.push(() => {
                attributeCopier(e, attributeName, attributeValue, environment);
            });
        },
        "[dnx-click]": function(e, attributeName, attributeValue, environment) {
            e.addEventListener(attributeName, (event) =>{
                let localExecutionContext=environment.add({
                    name: "event",
                    value: event
                });
                Function(localExecutionContext.getVarNames(), attributeValue).apply(null, localExecutionContext.getVarValues());
                element.dnxUpdate();
            }); 
        },
        "[dnx-submit]": function(e, attributeName, attributeValue, environment) {
            e.addEventListener(attributeName, (event) =>{
                let localExecutionContext=environment.add({
                    name: "value",
                    value: event.target.value
                });
                Function(localExecutionContext.getVarNames(), attributeValue).apply(null, localExecutionContext.getVarValues());
                element.dnxUpdate();
            }); 
        },
        "[dnx-input]": function(e, attributeName, attributeValue, environment) {
            e.addEventListener(attributeName, (event) =>{
                let localExecutionContext=environment.add({
                    name: "value",
                    value: event.target.value
                });
                Function(localExecutionContext.getVarNames(), attributeValue).apply(null, localExecutionContext.getVarValues());
                element.dnxUpdate();
            }); 
        },
        "[dnx-value]": function(e, attributeName, attributeValue, environment) {
            e.addEventListener("input", function(event) {
                let localExecutionContext=environment.add({
                    name: "value",
                    value: event.target.value
                });
                Function(localExecutionContext.getVarNames(), attributeValue+"=value;").apply(null, localExecutionContext.getVarValues());
                element.dnxUpdate();
            });
            updaters.push(() => {
                attributeCopier(e, attributeName, attributeValue, environment);
            });
        },
        "[dnx-checked]": function(e, attributeName, attributeValue, environment) {
            e.addEventListener("input", function(event) {
                let localExecutionContext=environment.add({
                    name: "value",
                    value: event.target.value
                });
                Function(localExecutionContext.getVarNames(), attributeValue+"=value;").apply(null, localExecutionContext.getVarValues());
                element.dnxUpdate();
            });
            updaters.push(() => {
                attributeCopier(e, attributeName, attributeValue, environment);
            });
        }
    };
    
    function match(tagName, attributeName, selector) {
        if(/.+\[.+\]/.exec(selector)) {
            var result=/(.+)\[(.+)\]/.exec(selector);
            return result[1].toLowerCase() === tagName.toLowerCase() && result[2].toLowerCase() === attributeName.toLowerCase();
        }else{
            var result=/\[(.+)\]/.exec(selector);
            return result[1].toLowerCase() === attributeName.toLowerCase();
        }
    }
    
    for(let selector in processorsBySelector) {
        for(let e of element.querySelectorAll(selector)) {
            //TODO: escenarios: e is in another root
            for(let aName of e.getAttributeNames()) {
                if(match(e.tagName.toLowerCase(), aName, selector)) {
                    let dnxAttributeName=/.*\[(dnx-.+)\]/.exec(selector)[1];
                    let attributeName=/dnx-(.+)/.exec(dnxAttributeName)[1]
                    console.log("prepare attribute"+selector+": "+dnxAttributeName);
                    processorsBySelector[selector](e, attributeName, e.getAttribute(dnxAttributeName), environment);
                }
            }
        }
    }
    
    element.dnxUpdate=function() {
        updaters.forEach(updater => {
            updater();
        });
    };
    
}
