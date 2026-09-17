// Rendered by ProductCodePanel and compiled unchanged by the example qualification.
export const kotlinExamples = {
    actionCode: `data class ReserveTicket(
    @field:NotNull val reservationId: ReservationId,
    @field:NotNull val ticketId: TicketId
) {
    @AssertLegal
    fun assertAvailable(ticket: Ticket) {
        if (ticket.status != AVAILABLE) {
            throw TicketErrors.notAvailable
        }
    }

    @Apply
    fun reserve(ticket: Ticket) =
        ticket.copy(status = RESERVED)

    @Apply
    fun createReservation(user: User) =
        Reservation.awaitingPayment(
            reservationId, ticketId, user.id())
}`,
    showModelCode: `@Model
data class Show(
    @EntityId val showId: ShowId,
    val name: String,
    val status: ShowStatus
)`,
    ticketModelCode: `@Model
data class Ticket(
    @EntityId val ticketId: TicketId,
    @Parent(pathInParent = "tickets")
    val showId: ShowId,
    val details: TicketDetails,
    val status: TicketStatus
)`,
    reservationModelCode: `@Model
data class Reservation(
    @EntityId val reservationId: ReservationId,
    @Parent(pathInParent = "reservations")
    val ticketId: TicketId,
    val customerId: String,
    val status: ReservationStatus,
    @field:ProtectData val contactEmail: String?
)`,
    testCode: `@Test
fun reservationIsLostWhenPaymentIsLate() {
    fixture
        .whenPostByUser("customer-42",
            "/api/reservations", "/ticketing/reserve.json")
        .expectEvents(ReserveTicket::class.java)
        .andThen()
        .whenTimeElapses(Duration.ofMinutes(15))
        .expectEvents(ExpireReservation::class.java)
}

@Test
fun reservationIsConfirmedWhenPaymentIsOnTime() {
    fixture
        .givenCommandsByUser("customer-42",
            "/ticketing/reserve-ticket.json")
        .whenEvent("/payments/payment-succeeded.json")
        .expectEvents("/ticketing/confirm-reservation.json")
        .andThen()
        .whenTimeElapses(Duration.ofMinutes(15))
        .expectNoEvents()
}`,
    searchCode: `data class FindAvailableTickets(
    @field:NotNull val showId: ShowId,
    @field:NotBlank val section: String
) {
    @HandleQuery
    fun handle(): List<Ticket> =
        Fluxzero.search(Ticket::class.java)
            .whereParent(showId)
            .match(AVAILABLE, "status")
            .match(section, "details/section")
            .sortBy("details/row")
            .fetch(50)
}`,
    timerCode: `@Component
class ReservationTimers {
    @HandleEvent
    fun start(event: ReserveTicket) {
        Fluxzero.scheduleCommand(
            ExpireReservation(event.reservationId),
            ScheduleId.of("expire", event.reservationId),
            Duration.ofMinutes(15))
    }

    @HandleEvent
    fun stop(event: ConfirmReservation) {
        Fluxzero.cancelSchedule(
            ScheduleId.of("expire", event.reservationId))
    }
}`,
    expiryCode: `data class ExpireReservation(
    @field:NotNull val reservationId: ReservationId
) {
    @AssertLegal
    fun assertAwaitingPayment(reservation: Reservation) {
        if (reservation.status != AWAITING_PAYMENT) {
            throw ReservationErrors.notAwaitingPayment
        }
    }

    @Apply
    fun remove(reservation: Reservation): Reservation? = null

    @Apply
    fun release(ticket: Ticket) =
        ticket.copy(status = AVAILABLE)
}`,
    personalDataCode: `@RequiresUser
data class UpdateContactEmail(
    @field:NotNull val reservationId: ReservationId,
    @field:NotBlank @field:Email @field:ProtectData
    val contactEmail: String
) {
    @AssertLegal
    fun assertOwner(reservation: Reservation, user: User) {
        if (reservation.customerId != user.id()) {
            throw ReservationErrors.notOwner
        }
    }

    @Apply
    fun update(reservation: Reservation) =
        reservation.copy(contactEmail = contactEmail)
}`,
    webCode: `@Component
@Path("/api/reservations")
class ReservationApi {
    @HandlePost
    fun reserve(@Valid request: ReservationRequest): ReservationId {
        val reservationId = Fluxzero.generateId(
            ReservationId::class.java)

        Fluxzero.sendCommandAndWait<Any>(
            ReserveTicket(reservationId, request.ticketId))
        return reservationId
    }
}`,
    historyCode: `@Component
@Consumer(name = "customer-rewards", minIndex = 0)
class CustomerRewards {
    @HandleEvent
    fun reward(
        event: ConfirmReservation,
        reservation: Reservation
    ) {
        Fluxzero.assertAndApply(
            GrantReward(event.reservationId,
                reservation.customerId, 100))
    }
}`,
    paymentProcessCode: `@Stateful
data class PaymentProcess(
    @EntityId val reservationId: ReservationId,
    @field:Association val pspReference: String
) {
    companion object {
        @JvmStatic
        @HandleEvent
        fun start(event: ReserveTicket): PaymentProcess {
            val pspReference = Fluxzero.sendCommandAndWait<String>(
                StartPayment(event.reservationId))
            return PaymentProcess(event.reservationId, pspReference)
        }
    }

    @HandleEvent
    fun complete(event: PaymentSucceeded): PaymentProcess? {
        Fluxzero.sendCommandAndWait<Any>(
            ConfirmReservation(reservationId))
        return null
    }
}`,
    queryCallerCode: `@Component
@Path("/api/tickets")
class TicketApi {
    @HandleGet
    fun available(
        @QueryParam showId: ShowId,
        @QueryParam section: String
    ): List<Ticket> =
        Fluxzero.queryAndWait(FindAvailableTickets(showId, section))
}`,
    consumerCode: `@Component
@Consumer(name = "fraud-detection", threads = 4)
class FraudDetection {
    @HandleEvent
    fun check(event: ConfirmReservation) {
        val assessment = Fluxzero.queryAndWait<FraudAssessment>(
            CheckForFraud(event.reservationId))

        if (assessment.requiresReview) {
            Fluxzero.sendAndForgetCommand(
                ReviewReservation(event.reservationId, assessment))
        }
    }
}`,
};
