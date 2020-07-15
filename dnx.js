export {dnx};

class ExecutionStack {
    
    constructor(content) {
        if(Array.isArray(content)){
            this.list=content;
        }else if(content){
            this.list=[content];
        }else{
            this.list=[];
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

class AttributeValueExpression {
    
    constructor(expr) {
        this.expr=expr;
    }
    
    getValue(self, executionStack) {
        return Function(executionStack ? executionStack.getVarNames(): [], "return "+this.expr+";").apply(self, executionStack ? executionStack.getVarValues(): []);
    }
    
    setValue(self, value, executionStack) {
        let executionElement={
            name: "value",
            value: value
        };
        let assignExecutionStack=executionStack ? executionStack.add(executionElement): new ExecutionStack(executionElement);
        Function(assignExecutionStack.getVarNames(), this.expr+"=value;").apply(self, assignExecutionStack.getVarValues());
    }
    
    execute(self, executionStack) {
        return Function(executionStack? executionStack.getVarNames(): [], this.expr).apply(self, executionStack? executionStack.getVarValues(): []);
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
    
    let contextValueExpr=null;
    
    if(element.getAttribute("dnx-contextValue")) {
        contextValueExpr=new AttributeValueExpression(element.getAttribute("dnx-contextValue"));
    }
    
    if(!(contextParam && contextParam.value) && contextValueExpr) {
        context.value=contextValueExpr.getValue(null);
    }
    
    let proxy=wrapProxy(element, context);
    process(element, new ExecutionStack({
        name: context.name,
        value: proxy
    }));
    
    if(contextValueExpr) {
        contextValueExpr.setValue(element, proxy);
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

let processedElements=[];

function process(element, executionStack) {
    let updaters=[];
    
    function attributeCopier(e, attributeName, attributeValueExp, executionStack) {
        e[attributeName]=attributeValueExp.getValue(null, executionStack);
    }

    const processorsBySelector={
        "[dnx-items]": function(e, attributeName, attributeValueExpr, executionStack) {
            let parent=e.parentNode;
            let sibling=e.nextSibling;
            let generated=[];
            updaters.push(() => {
                for(let g of generated) {
                    g.remove();
                }
                generated.length=0;
                for(let item of attributeValueExpr.getValue(null, executionStack)) {
                    let cloneNode=e.cloneNode(true);
                    process(cloneNode, executionStack.add({
                        name: e.getAttribute("dnx-item"),
                        value: item
                    }));
                    parent.insertBefore(cloneNode, sibling);
                    generated.push(cloneNode);
                    cloneNode.dnxUpdate();
                }
                e.remove();
            });
            processedElements.push(e);
        },
        "[dnx-innerHTML]": function(e, attributeName, attributeValueExpr, executionStack) {
            updaters.push(() => {
                attributeCopier(e, attributeName, attributeValueExpr, executionStack);
            });
        },
        "[dnx-attached]": function(e, attributeName, attributeValueExpr, executionStack) {
            let parent=e.parentNode;
            let next={
                value:null
            };
            updaters.push(() => {
                const value=attributeValueExpr.getValue(null, executionStack);
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
        "[dnx-disabled]": function(e, attributeName, attributeValueExpr, executionStack) {
            updaters.push(() => {
                attributeCopier(e, attributeName, attributeValueExpr, executionStack);
            });
        },
        "img[dnx-src]": function(e, attributeName, attributeValueExpr, executionStack) {
            updaters.push(() => {
                attributeCopier(e, attributeName, attributeValueExpr, executionStack);
            });
        },
        "[dnx-click]": function(e, attributeName, attributeValueExpr, executionStack) {
            e.addEventListener(attributeName, (event) =>{
                attributeValueExpr.execute(null, executionStack.add({
                    name: "event",
                    value: event
                }));
                element.dnxUpdate();
            }); 
        },
        "[dnx-submit]": function(e, attributeName, attributeValueExpr, executionStack) {
            e.addEventListener(attributeName, (event) =>{
                attributeValueExpr.execute(null, executionStack.add({
                    name: "value",
                    value: event.target.value
                }));
                element.dnxUpdate();
            }); 
        },
        "[dnx-input]": function(e, attributeName, attributeValueExpr, executionStack) {
            e.addEventListener(attributeName, (event) =>{
                attributeValueExpr.execute(null, executionStack.add({
                    name: "value",
                    value: event.target.value
                }));
                element.dnxUpdate();
            }); 
        },
        "[dnx-value]": function(e, attributeName, attributeValueExpr, executionStack) {
            e.addEventListener("input", function(event) {
                attributeValueExpr.setValue(null, event.target.value, executionStack);
                element.dnxUpdate();
            });
            updaters.push(() => {
                attributeCopier(e, attributeName, attributeValueExpr, executionStack);
            });
        },
        "[dnx-checked]": function(e, attributeName, attributeValueExpr, executionStack) {
            e.addEventListener("input", function(event) {
                attributeValueExpr.setValue(null, event.target.value, executionStack);
                element.dnxUpdate();
            });
            updaters.push(() => {
                attributeCopier(e, attributeName, attributeValueExpr, executionStack);
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
            let b=false;
            for(let p of processedElements) {
                if(p.contains(e)) {
                   b=true;
                   break;
                }
            }
            if(!b){
                for(let aName of e.getAttributeNames()) {
                    if(match(e.tagName.toLowerCase(), aName, selector)) {
                        let dnxAttributeName=/.*\[(dnx-.+)\]/.exec(selector)[1];
                        let attributeName=/dnx-(.+)/.exec(dnxAttributeName)[1]
                        console.log("prepare attribute"+selector+": "+dnxAttributeName);
                        processorsBySelector[selector](e, attributeName, new AttributeValueExpression(e.getAttribute(dnxAttributeName)), executionStack);
                    }
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
