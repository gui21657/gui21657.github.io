console.log('Chart.js version:', Chart.version);

document.getElementById('calcularBtn').addEventListener('click', function() {
    const tipo = document.getElementById('tipoGradiente').value;
    const a = parseFloat(document.getElementById('aInput').value);
    const g = parseFloat(document.getElementById('gInput').value);
    const i = parseFloat(document.getElementById('iInput').value);
    const n = parseInt(document.getElementById('nInput').value);

    let resultado = 0;
    let cashFlow = [];

    if (tipo === 'geometrico') {
        resultado = calcularFactorPresenteGeometrico(a, g, i, n);
        document.getElementById('output').textContent = `Valor presente del gradiente geométrico: ${resultado.toFixed(2)}`;
        cashFlow = calcularFlujoGeometrico(a, g, i, n);
    } else if (tipo === 'aritmetico') {
        resultado = calcularFactorPresenteAritmetico(a, i, n);
        document.getElementById('output').textContent = `Valor presente del gradiente aritmético: ${resultado.toFixed(2)}`;
        cashFlow = calcularFlujoAritmetico(a, i, n);
    }

    console.log('Flujo de efectivo:', cashFlow);

    if (cashFlow.length > 0) {
        mostrarGrafico(cashFlow);
    } else {
        console.error('No se generó ningún flujo de efectivo.');
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

function calcularFactorPresenteAritmetico(a, i, n) {
    const iDecimal = i / 100;
    
    return a * ((Math.pow(1 + iDecimal, n) - iDecimal * n - 1) / (Math.pow(iDecimal, 2) * Math.pow(1 + iDecimal, n)));
}

function calcularFlujoGeometrico(a, g, i, n) {
    let cashFlow = [];
    let valor = a;
    for (let i = 0; i < n; i++) {
        cashFlow.push(valor);
        valor *= (1 + g / 100);
    }
    return cashFlow;
}

function calcularFlujoAritmetico(a, i, n) {
    let cashFlow = [];
    let valor = a;
    for (let i = 0; i < n; i++) {
        cashFlow.push(valor);
        valor += i;
    }
    return cashFlow;
}

function mostrarGrafico(cashFlow) {
    const canvasElement = document.getElementById('cashFlowChart');
    
    if (canvasElement) {
        const ctx = canvasElement.getContext('2d');
        
        // Verificar si ya existe un gráfico, y destruirlo si es necesario
        if (window.cashFlowChart && typeof window.cashFlowChart.destroy === 'function') {
            window.cashFlowChart.destroy();
        }

        // Crear el nuevo gráfico
        window.cashFlowChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: cashFlow.map((_, index) => `Periodo ${index + 1}`),
                datasets: [{
                    label: 'Flujo de Efectivo',
                    data: cashFlow,
                    backgroundColor: 'rgba(116, 235, 213, 0.5)',
                    borderColor: 'rgba(116, 235, 213, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'USD' }).format(value);
                            },
                            min: 0,
                        }
                    }
                },
                responsive: true,
                maintainAspectRatio: true,
            }
        });
    } else {
        console.error('No se pudo encontrar el elemento canvas con el ID cashFlowChart.');
    }
}
 
