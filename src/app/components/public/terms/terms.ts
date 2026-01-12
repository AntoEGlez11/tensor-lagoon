import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-terms',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
    <div class="min-h-screen bg-auto-black pt-24 pb-12 px-4">
      <div class="container mx-auto max-w-3xl">
        <div class="mb-8">
          <a routerLink="/dashboard" class="text-auto-accent hover:text-white transition-colors">← Volver al Dashboard</a>
        </div>
        
        <div class="bg-auto-carbon border border-white/10 rounded-2xl p-8 shadow-xl">
          <h1 class="text-3xl font-bold text-white mb-6">Términos y Condiciones del Sorteo</h1>
          
          <div class="space-y-6 text-gray-300">
            <section>
              <h2 class="text-xl font-bold text-white mb-2">1. Elegibilidad</h2>
              <p>El sorteo está abierto a residentes de México mayores de 18 años. Los empleados de Tensor Lagoon y sus familiares directos no son elegibles para participar.</p>
            </section>

            <section>
              <h2 class="text-xl font-bold text-white mb-2">2. Mecánica de Participación</h2>
              <p>Para participar, el usuario debe generar un folio único a través del dashboard y realizar el pago de la cuota de recuperación ($50.00 MXN) mediante transferencia bancaria.</p>
            </section>

            <section>
              <h2 class="text-xl font-bold text-white mb-2">3. Validación y Boletos</h2>
              <p>El folio generado es una referencia de pre-registro. La participación solo es válida una vez que el administrador ha verificado el pago y marcado el estado como "Verificado".</p>
            </section>

            <section>
              <h2 class="text-xl font-bold text-white mb-2">4. Premios</h2>
              <p>El premio consiste en un servicio "Premium Total" para un vehículo. El premio no es transferible ni canjeable por efectivo.</p>
            </section>
            
            <section>
              <h2 class="text-xl font-bold text-white mb-2">5. Cancelaciones y Reembolsos</h2>
              <p>Una vez realizado el pago, no existen reembolsos salvo cancelación del evento por parte de los organizadores.</p>
            </section>
          </div>
          
          <div class="mt-8 pt-6 border-t border-white/10 text-center text-sm text-gray-500">
            Actualizado: Enero 2026
          </div>
        </div>
      </div>
    </div>
  `
})
export class TermsComponent { }
