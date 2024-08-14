document.getElementById('calcularBtn').addEventListener('click', function() {
    const tipo = document.getElementById('tipoGradiente').value;
    const a = parseFloat(document.getElementById('aInput').value);
    const g = parseFloat(document.getElementById('gInput').value);
    const i = parseFloat(document.getElementById('iInput').value);
    const n = parseInt(document.getElementById('nInput').value);

    let resultado = 0;

    if (tipo === 'geometrico') {
        resultado = calcularFactorPresenteGeometrico(a, g, i, n);
        document.getElementById('output').textContent = `Valor presente del gradiente geométrico: ${resultado.toFixed(2)}`;
    } else if (tipo === 'aritmetico') {
        resultado = calcularFactorPresenteAritmetico(g, i, n);
        document.getElementById('output').textContent = `Valor presente del gradiente aritmético: ${resultado.toFixed(2)}`;
    }
});

function calcularFactorPresenteGeometrico(a, g, i, n) {
    const gDecimal = g / 100;
    const iDecimal = i / 100;
    
    if (iDecimal === gDecimal) {
        return (n * a) / (1 + iDecimal);
    }
    
    return a * ((1 - Math.pow(1 + gDecimal, n) * Math.pow(1 + iDecimal, -n)) / (iDecimal - gDecimal));
}

function calcularFactorPresenteAritmetico(g, i, n) {
    const gDecimal = g / 100;
    const iDecimal = i / 100;
    
    return gDecimal * ((Math.pow(1 + iDecimal, n) - iDecimal * n - 1) / (Math.pow(iDecimal, 2) * Math.pow(1 + iDecimal, n)));
}
