/*
interface String {
    format(): string;
}
*/
// https://www.damirscorner.com/blog/posts/20180216-VariableNumberOfArgumentsInTypescript.html
String.prototype.format = function () {
    var result = this;
    //console.log("String.prototype.format")
    //console.log(result)
    for (var i = 0; i < arguments.length; i++) {
        var reg = new RegExp("\\{\\}", "m");
        result = result.replace(reg, arguments[i]);
    }
    //console.log(result)
    return result;
};
String.prototype.formatM = function (...args) {
    var s = this, i = args.length;
    while (i--) {
        //        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};
String.prototype.formatN = function () {
    var result = this;
    for (var i = 0; i < arguments.length; i++) {
        var reg = new RegExp("\\{" + i + "\\}", "gm");
        result = result.replace(reg, arguments[i + 1]);
    }
    return result;
};
//# sourceMappingURL=string.extensions.js.map