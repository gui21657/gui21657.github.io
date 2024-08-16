console.log('Chart.js version:', Chart.version);

// Manejo de evento para el cambio en el tipo de gradiente
document.getElementById('tipoGradiente').addEventListener('change', function() {
    // Restablecer los valores de los inputs
    document.getElementById('aInput').value = '';
    document.getElementById('gInput').value = '';
    document.getElementById('iInput').value = '';
    document.getElementById('nInput').value = '';
    document.getElementById('GInput').value = '';
    document.getElementById('output').textContent = ''; // Limpiar el resultado
    if (window.cashFlowChart && typeof window.cashFlowChart.destroy === 'function') {
        window.cashFlowChart.destroy();
        window.cashFlowChart = null; // Asegurarse de que se puede crear un nuevo gráfico más tarde
    }
    const tipo = this.value;

    // Ocultar todos los grupos
    document.getElementById('aGroup').style.display = 'none';
    document.getElementById('gGroup').style.display = 'none';
    document.getElementById('iGroup').style.display = 'none';
    document.getElementById('nGroup').style.display = 'none';
    document.getElementById('GGroup').style.display = 'none';

    // Mostrar los grupos según la selección
    if (['geometrico'].includes(tipo)) {
        document.getElementById('aGroup').style.display = 'block';
        document.getElementById('gGroup').style.display = 'block';
        document.getElementById('iGroup').style.display = 'block';
        document.getElementById('nGroup').style.display = 'block';
        
    }
    if (['aritmetico'].includes(tipo)) {
        document.getElementById('aGroup').style.display = 'block';
        
        document.getElementById('iGroup').style.display = 'block';
        document.getElementById('nGroup').style.display = 'block';
        
    }
    if (['FuturoCompuesto'].includes(tipo)) {
        document.getElementById('aGroup').style.display = 'block';
        
        document.getElementById('iGroup').style.display = 'block';
        document.getElementById('nGroup').style.display = 'block';
        
    }
    if (['FuturoSimple'].includes(tipo)) {
        document.getElementById('aGroup').style.display = 'block';
        
        document.getElementById('iGroup').style.display = 'block';
        document.getElementById('nGroup').style.display = 'block';
        
    }
    if (['AnualidadAritmetico'].includes(tipo)) {
        document.getElementById('iGroup').style.display = 'block';
        document.getElementById('nGroup').style.display = 'block';
        document.getElementById('GGroup').style.display = 'block';
    }
    if (['FuturoGeometrico'].includes(tipo)) {
        document.getElementById('aGroup').style.display = 'block';
        document.getElementById('gGroup').style.display = 'block';
        document.getElementById('iGroup').style.display = 'block';
        document.getElementById('nGroup').style.display = 'block';
        
    }
    if (['FuturoAritmetico'].includes(tipo)) {

        document.getElementById('iGroup').style.display = 'block';
        document.getElementById('nGroup').style.display = 'block';
        document.getElementById('GGroup').style.display = 'block';
    }

});

// Ejecutar la función al cargar la página para ajustar la vista inicial
document.getElementById('tipoGradiente').dispatchEvent(new Event('change'));

// Manejo de evento para el botón de cálculo
document.getElementById('calcularBtn').addEventListener('click', function() {
    const tipo = document.getElementById('tipoGradiente').value;
    const a = parseFloat(document.getElementById('aInput').value);
    const g = parseFloat(document.getElementById('gInput').value);
    const i = parseFloat(document.getElementById('iInput').value);
    const n = parseInt(document.getElementById('nInput').value);
    const G = parseInt(document.getElementById('GInput').value);
    
    let resultado = 0;
    let cashFlow = [];

    // Uso de la fórmula correspondiente según el tipo seleccionado
    if (tipo === 'geometrico') {
        resultado = formulas['geometrico'](a, g, i, n, G);
    } else if (tipo === 'aritmetico') {
        resultado = formulas['aritmetico'](a, g, i, n, G);
    } else if (tipo === 'FuturoCompuesto') {
        resultado = formulas['FuturoCompuesto'](a, i, n);
    } else if (tipo === 'FuturoSimple') {
        resultado = formulas['FuturoSimple'](a, g, i, n, G);
    } else if (tipo === 'AnualidadAritmetico') {
        resultado = formulas['AnualidadAritmetico'](a, g, i, n, G);
    } else if (tipo === 'FuturoGeometrico') {
        resultado = formulas['FuturoGeometrico'](a, g, i, n);
    } else if (tipo === 'FuturoAritmetico') {
        resultado = formulas['FuturoAritmetico']( i, n, G);
    } else {
        console.error('Tipo de gradiente no reconocido.');
    }

    document.getElementById('output').textContent = `Resultado: ${resultado.toFixed(2)}`;

    if (formulas[tipo]) {
        cashFlow = calcularFlujo(tipo, a, g, i, n, G, resultado);
    }

    console.log('Flujo de efectivo:', cashFlow);

    if (cashFlow.length > 0) {
        mostrarGrafico(cashFlow);
    } else {
        console.error('No se generó ningún flujo de efectivo.');
    }
});

// Diccionario de fórmulas
const formulas = {
    'geometrico': function(a, g, i, n, G) {
        const gDecimal = g / 100;
        const iDecimal = i / 100;

        if (iDecimal === gDecimal) {
            return (n * a) / (1 + iDecimal);
        }

        return a * ((1 - Math.pow(1 + gDecimal, n) * Math.pow(1 + iDecimal, -n)) / (iDecimal - gDecimal));
    },
    'aritmetico': function(a, g, i, n, G) {
        const iDecimal = i / 100;

        return a * ((Math.pow(1 + iDecimal, n) - iDecimal * n - 1) / (Math.pow(iDecimal, 2) * Math.pow(1 + iDecimal, n)));
    },
    'FuturoCompuesto': function(a, i, n) {
        const iDecimal = i / 100;
        return a * Math.pow(1 + iDecimal, n); // interés compuesto
    },
    'FuturoSimple': function(a, g, i, n, G) {
        const iDecimal = i / 100;
        return (a * iDecimal * n) + a; // interés simple
    },
    'AnualidadAritmetico': function(a, g, i, n, G) {
        const iDecimal = i / 100;
        return G * ((1 / iDecimal) - (n / (Math.pow(1 + iDecimal, n) - 1)));
    },
    'FuturoGeometrico': function(a, g, i, n) {
        const gDecimal = g / 100;
        const iDecimal = i / 100;
        
        if (gDecimal !== iDecimal) {
            return a * ((Math.pow(1 + gDecimal, n) - Math.pow(1 + iDecimal, n)) / (gDecimal - iDecimal));
        } else {
            // Caso especial cuando g == i
            return n * a * Math.pow(1 + iDecimal, n - 1);
        }
    },
    'FuturoAritmetico': function( i, n, G) {
        const iDecimal = i / 100;  // Convertir la tasa de interés a decimal
    
        // Calcular el valor futuro del gradiente aritmético
        return G * (((Math.pow(1 + iDecimal, n) - 1) / iDecimal) - n);
    }
};

function calcularFlujo(tipo, a, g, i, n, G, resultadoFinal) {
    let cashFlow = [];
    
    // Registrar el primer valor como el valor inicial (positivo)
    cashFlow.push(-a , -G);

    // Luego, calcular el flujo para los periodos subsecuentes usando la fórmula correspondiente
    for (let j = 1; j <= n; j++) {
        let valor;
        if (tipo === 'geometrico') {
            valor = formulas['geometrico'](a, g, i, j);  // Reemplaza n con j
        } else if (tipo === 'aritmetico') {
            valor = formulas['aritmetico'](a, g, i, j);  // Reemplaza n con j
        } else if (tipo === 'FuturoCompuesto') {
            valor = formulas['FuturoCompuesto'](a, i, j);   // Reemplaza n con j
        } else if (tipo === 'FuturoSimple') {
            valor = formulas['FuturoSimple'](a, g, i, j, G);   // Reemplaza n con j
        } else if (tipo === 'AnualidadAritmetico') {
            valor = formulas['AnualidadAritmetico'](a, g, i, j, G);   // Reemplaza n con j
        } else if (tipo === 'FuturoGeometrico') {
            valor = formulas['FuturoGeometrico'](a, g, i, j);   // Reemplaza n con j
        } else if (tipo === 'FuturoAritmetico') {
            valor = formulas['FuturoAritmetico']( i, j, G);   // Reemplaza n con j
        }
        
        cashFlow.push(valor);
    }

    return cashFlow;
}

// Función para mostrar el gráfico
function mostrarGrafico(cashFlow) {
    const canvasElement = document.getElementById('cashFlowChart');
    
    if (canvasElement) {
        const ctx = canvasElement.getContext('2d');
        
        if (window.cashFlowChart && typeof window.cashFlowChart.destroy === 'function') {
            window.cashFlowChart.destroy();
        }

        window.cashFlowChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: cashFlow.map((_, index) => `Periodo ${index}`),
                datasets: [{
                    label: 'Flujo de Efectivo',
                    data: cashFlow,
                    backgroundColor: cashFlow.map(value => value < 0 ? 'rgba(255, 99, 132, 0.5)' : 'rgba(116, 235, 213, 0.5)'),
                    borderColor: cashFlow.map(value => value < 0 ? 'rgba(255, 99, 132, 1)' : 'rgba(116, 235, 213, 1)'),
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
